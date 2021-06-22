// Inspired by https://github.com/BarnBridge/BarnBridge-YieldFarming/blob/master/contracts/YieldFarm.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "../StakingMilestones/IStakingMilestones.sol";
import "./IYieldFarm.sol";


contract StakingWeeklyRewards is OwnableUpgradeSafe {

    // lib
    using SafeMath for uint;
    using SafeMath for uint128;

    // addreses
    // contracts
    address public _vault; // init from YieldFarm contract
    IERC20 public _slice; // init from YieldFarm contract
    IERC20 public _stakableToken; // init from YieldFarm contract
    IStakingMilestones public _staking; // init from YieldFarm contract

    // Total amount of SLICE tokens to be rewarded if user stakes one token per epoch
    mapping (uint128 => uint256) public rewardPerTokenInEpoch;
    // Total SLICE distributed as rewards
    uint public totalRewardsDistributed; // init from YieldFarm contract

    // last epoch in which user claimed their reward
    mapping(address => uint128) private lastRewardClaimed;
    uint public epochDuration; // init from YieldFarm contract
    uint public epochStart; // init from YieldFarm contract
    uint128 public startEpochId; // epoch ID in YieldFarm when this contract was initialized

    // events
    event Claimed(address indexed user, uint128 indexed epochId, uint256 amount);
    event RewardPerTokenInEpochUpdated(uint128 epochId, uint totalReward);

    // constructor
    function initialize(
        address yieldFarm,
        address stakableToken,
        uint256 _rewardPerTokenInEpoch
    ) external initializer {
        require(_rewardPerTokenInEpoch > 0, "StakingWeeklyRewards: Reward should be greater than 0!");
        require(yieldFarm != address(0), "StakingWeeklyRewards: Invalid YieldFarm address");
        require(stakableToken != address(0), "StakingWeeklyRewards: Invalid stakable token address");
        
        OwnableUpgradeSafe.__Ownable_init();
        IYieldFarm _yieldFarm = IYieldFarm(yieldFarm);
        epochDuration = _yieldFarm.epochDuration();
        epochStart = _yieldFarm.epochStart();

        startEpochId = uint128(_yieldFarm.getCurrentEpoch());
        rewardPerTokenInEpoch[startEpochId] = _rewardPerTokenInEpoch;

        require(_yieldFarm.totalRewardInEpoch(startEpochId) == 0, "StakingWeeklyRewards: Reward distribution in YieldFarm still ongoing");

        _slice = IERC20(_yieldFarm._slice());
        _stakableToken = IERC20(stakableToken);
        _staking = IStakingMilestones(_yieldFarm._staking());
        _vault = _yieldFarm._vault();
        totalRewardsDistributed = _yieldFarm.totalRewardsDistributed();
    }

    function setRewardPerTokenInEpoch(uint128 epochId, uint _rewardPerTokenInEpoch) external onlyOwner {
        require(epochId >= _getEpochId(), "StakingWeeklyRewards: Epoch ID should be greater than the current epoch ID");
        
        rewardPerTokenInEpoch[epochId] = _rewardPerTokenInEpoch;
        
        emit RewardPerTokenInEpochUpdated(epochId, _rewardPerTokenInEpoch);
    }

    // external methods
    function claim() external returns (uint) {
        
        uint totalDistributedValue;
        uint128 epochId = uint128(_getEpochId().sub(1));

        if (lastRewardClaimed[msg.sender] == 0) lastRewardClaimed[msg.sender] = uint128(startEpochId.sub(1));

        for (uint128 i = uint128(lastRewardClaimed[msg.sender].add(1)); i <= epochId; i++) {
            if (rewardPerTokenInEpoch[i] == 0) _initEpoch(i);
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            totalDistributedValue = totalDistributedValue.add(_calculateReward(i));
        }

        totalRewardsDistributed = totalRewardsDistributed.add(totalDistributedValue);

        // Set user's last reward claimed epoch
        lastRewardClaimed[msg.sender] = epochId;

        emit Claimed(msg.sender, epochId, totalDistributedValue);

        if (totalDistributedValue > 0) {
            SafeERC20.safeTransferFrom(_slice, _vault, msg.sender, totalDistributedValue);
        }

        return totalDistributedValue;

    }

    function getCurrentEpoch() external view returns (uint) {
        return _getEpochId();
    }

    // calls to the staking smart contract to retrieve user balance for an epoch
    function getEpochStake(address userAddress, uint128 epochId) external view returns (uint) {
        return _getUserBalancePerEpoch(userAddress, epochId);
    }

    function userlastRewardClaimed() external view returns (uint){
        return lastRewardClaimed[msg.sender];
    }

    // Will return correct rewards if all epochs before the current epoch have been initialized
    function getTotalAccruedRewards(address user) external view returns (uint rewards) {
        uint128 currentEpoch = _getEpochId();
        uint128 firstRewardableEpoch;
        if (lastRewardClaimed[msg.sender] > 0) {
            firstRewardableEpoch = uint128(lastRewardClaimed[user].add(1));
        } else {
            firstRewardableEpoch = startEpochId;
        }

        if (firstRewardableEpoch == currentEpoch) return 0;

        for (uint128 i = firstRewardableEpoch; i < currentEpoch; i++) {
            rewards = rewards.add(rewardPerTokenInEpoch[i]
                .mul(_getUserBalancePerEpoch(user, i))).div(1e18);
        }
    }

    function initEpoch(uint128 epochId) external returns (bool) {
        require(epochId > startEpochId, "StakingWeeklyRewards: Epoch is in the past");
        require(rewardPerTokenInEpoch[uint128(epochId.sub(1))] > 0, "StakingWeeklyRewards: Previous epoch not initialized");
        require(rewardPerTokenInEpoch[epochId] == 0, "StakingWeeklyRewards: Epoch already initialized");

        _initEpoch(epochId);

    }

    // internal methods

    function _initEpoch(uint128 epochId) internal {

        rewardPerTokenInEpoch[epochId] = rewardPerTokenInEpoch[uint128(epochId.sub(1))];

    }

    function _calculateReward(uint128 epochId) internal view returns (uint) {

        uint reward = rewardPerTokenInEpoch[epochId]
            .mul(_getUserBalancePerEpoch(msg.sender, epochId)).div(1e18);

        return reward;

    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId) internal view returns (uint){
        // retrieve stable coins total staked per user in epoch

        return _staking.getEpochUserBalance(userAddress, address(_stakableToken), epochId);
    }

    // compute epoch id from blocktimestamp and epochstart date
    function _getEpochId() internal view returns (uint128 epochId) {
        epochId = uint128(block.timestamp.sub(epochStart).div(epochDuration).add(1));
    }
}
