// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "./IStakingMilestones.sol";
import "./IYieldFarm.sol";


contract StakingRewards is OwnableUpgradeSafe, ReentrancyGuardUpgradeSafe {

    // lib
    using SafeMath for uint;
    using SafeMath for uint128;

    // addreses
    // contracts
    address public _vault; // init from YieldFarm contract
    IERC20 public _slice; // init from YieldFarm contract
    IERC20 public _stakableToken; // init from YieldFarm contract
    IStakingMilestones public _staking; // init from YieldFarm contract
    IYieldFarm public _yieldFarm; // YieldFarm contract which was used to distribute rewards earlier

    // Different durations in which a user will receive rewards
    uint256 public rewardDuration5 = 2 * (365 days); // 2 years
    uint256 public rewardDuration4 = rewardDuration5.div(2); // 1 year
    uint256 public rewardDuration3 = rewardDuration5.div(4); // 6 months
    uint256 public rewardDuration2 = rewardDuration5.div(24); // 1 month
    uint256 public rewardDuration1 = 7 days; // 1 week

    mapping (uint8 => uint256) public reward; // Rewards corresponding to all reward durations(1 to 5)

    uint128 public startEpochId; // epoch ID in YieldFarm when this contract was initialized
    uint public epochDuration; // init from YieldFarm contract
    uint public epochStart; // init from YieldFarm contract

    // a checkpoint of the user balances and withdrawals
    struct Checkpoint {
        uint256 lastWithdrawal; // timestamp
        uint256 previousToLastWithdrawal; // timestamp
    }

    mapping (address => Checkpoint) internal userCheckpoints;

    // Total SLICE distributed as rewards
    uint public totalRewardsDistributed; // Init from YieldFarm contract and carried forward

    // events
    event Harvest(address indexed user, uint256 amount);
    event RewardsSet(uint256[] rewards);
    event A(address a);
    event B(uint256 b);
    event C(uint128 c);

    // constructor
    function initialize(
        address yieldFarm,
        address stakableToken
    ) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        _yieldFarm = IYieldFarm(yieldFarm);
        epochDuration = _yieldFarm.epochDuration();
        epochStart = _yieldFarm.epochStart();

        startEpochId = uint128(_yieldFarm.getCurrentEpoch());

        require(_yieldFarm.totalRewardInEpoch(startEpochId) == 0, "StakingRewards: Reward distribution in YieldFarm still ongoing");

        _slice = IERC20(_yieldFarm._slice());
        _stakableToken = IERC20(stakableToken);
        _staking = IStakingMilestones(_yieldFarm._staking());
        _vault = _yieldFarm._vault();
        totalRewardsDistributed = _yieldFarm.totalRewardsDistributed();
    }

    function harvest() external returns (uint) {
        uint totalDistributedValue = _harvest();
        
        emit Harvest(msg.sender, totalDistributedValue);

        if (totalDistributedValue > 0) {
            SafeERC20.safeTransferFrom(_slice, _vault, msg.sender, totalDistributedValue);
        }

        return totalDistributedValue;
    }

    function setRewards(uint256[] calldata rewards) external onlyOwner {
        require(rewards.length == 5, "StakingRewards: Invalid array length");

        reward[1] = rewards[0];
        reward[2] = rewards[1];
        reward[3] = rewards[2];
        reward[4] = rewards[3];
        reward[5] = rewards[4];

        emit RewardsSet(rewards);
    }

    function getCurrentEpochId() external view returns (uint128) {
        return _getEpochId(block.timestamp);
    }

    // calls to the staking smart contract to retrieve user balance for an epoch
    function getEpochStake(address userAddress, uint128 epochId) external view returns (uint) {
        return _getUserBalancePerEpoch(userAddress, epochId);
    }

    function userLastWithdrawal() external view returns (uint) {
        return userCheckpoints[msg.sender].lastWithdrawal;
    }

    function userPreviousToLastWithdrawal() external view returns (uint) {
        return userCheckpoints[msg.sender].previousToLastWithdrawal;
    }

    function getTotalAccruedRewards(address user) public view returns (uint totalReward) {

        uint128 initialEpochId;
        uint128 currentEpochId = _getEpochId(block.timestamp);
        Checkpoint memory checkpoint = userCheckpoints[user];

        if (checkpoint.lastWithdrawal == 0) {
            initialEpochId = startEpochId;
        } else if (checkpoint.lastWithdrawal.sub(checkpoint.previousToLastWithdrawal) <= rewardDuration1) {
            initialEpochId = _getEpochId(checkpoint.previousToLastWithdrawal);
        } else {
            initialEpochId = _getEpochId(checkpoint.lastWithdrawal);
        }

        uint256 duration;
        uint balance;

        // emit C(initialEpochId);
        // emit C(currentEpochId);

        for (uint128 i = initialEpochId; i < currentEpochId; i++) {

            balance = _getUserBalancePerEpoch(user, i);

            if (balance != _getUserBalancePerEpoch(user, i + 1) || (i + 1 == currentEpochId)) {

                duration = (((i + 1).sub(initialEpochId)).mul(epochDuration));
                initialEpochId = i + 1;

                if (duration < rewardDuration1) {

                    // Do nothing

                } else if (duration < rewardDuration2) {

                    totalReward = totalReward.add(balance.mul(reward[1]));

                } else if (duration < rewardDuration3) {

                    totalReward = totalReward.add(balance.mul(reward[2]));

                } else if (duration < rewardDuration4) {

                    totalReward = totalReward.add(balance.mul(reward[3]));

                } else if (duration < rewardDuration5) {

                    totalReward = totalReward.add(balance.mul(reward[4]));

                } else if (duration >= rewardDuration5) {

                    totalReward = totalReward.add(balance.mul(reward[5]));

                }

            }
            // } else {
            //     continue;
            // }
            
        }
    }

    function _harvest () internal returns (uint) {
        uint totalReward = getTotalAccruedRewards(msg.sender); 

        userCheckpoints[msg.sender].previousToLastWithdrawal = userCheckpoints[msg.sender].lastWithdrawal;
        userCheckpoints[msg.sender].lastWithdrawal = ((_getEpochId(block.timestamp).sub(1)).mul(epochDuration)).add(epochStart);

        totalRewardsDistributed = totalRewardsDistributed.add(totalReward);

        return totalReward;
    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId) internal view returns (uint){
        // retrieve stable coins total staked per user in epoch

        return _staking.getEpochUserBalance(userAddress, address(_stakableToken), epochId);
    }

    function _getEpochId(uint256 time) internal view returns (uint128 epochId) {
        epochId = uint128(time.sub(epochStart).div(epochDuration).add(1));
        // eopchBeginning = ((epochId.sub(1)).mul(epochDuration)).add(epochStart);
        // epochEnd = eopchBeginning.add(epochDuration);
    }
}
