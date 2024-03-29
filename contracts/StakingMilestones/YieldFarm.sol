// Inspired by https://github.com/BarnBridge/BarnBridge-YieldFarming/blob/master/contracts/YieldFarm.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "./IStakingMilestones.sol";


contract YieldFarm is OwnableUpgradeSafe {

    // lib
    using SafeMath for uint256;
    using SafeCast for uint256;

    // addreses
    // contracts
    address public _vault;
    IERC20 public _slice;
    IERC20 public _stakableToken;
    IStakingMilestones public _staking;

    // Store total pool size of each epoch
    mapping (uint128 => uint256) private epochs;
    // Total amount of SLICE tokens to be distributed in that epoch
    mapping (uint128 => uint256) public totalRewardInEpoch;
    // Total SLICE distributed since epochStart
    uint256 public totalRewardsDistributed;

    // id of last init epoch, for optimization purposes moved from struct to a single id.
    uint128 public lastInitializedEpoch;

    // state of user harvest epoch
    mapping(address => uint128) private lastEpochIdHarvested;
    uint256 public epochDuration; // init from staking contract
    uint256 public epochStart; // init from staking contract

    // events
    event MassHarvest(address indexed user, uint256 epochsHarvested, uint256 totalValue);
    event Harvest(address indexed user, uint128 indexed epochId, uint256 amount);
    event TotalRewardInEpochUpdated(uint128 epochId, uint256 totalReward);

    // constructor
    function initialize(
        address sliceAddress,
        address stakeContract,
        address stakableToken,
        address vault,
        uint256 _totalRewardInEpoch
    ) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        _slice = IERC20(sliceAddress);
        _stakableToken = IERC20(stakableToken);
        totalRewardInEpoch[1] = _totalRewardInEpoch;
        _staking = IStakingMilestones(stakeContract);
        _vault = vault;
        epochStart = _staking.epoch1Start();
        epochDuration = _staking.epochDuration();
    }

    function setTotalRewardInParticularEpoch(uint128 epochId, uint256 _totalRewardInEpoch) external onlyOwner {
        require(epochId > _getEpochId(), "YieldFarm: Epoch ID should be greater than the current epoch ID");
        
        totalRewardInEpoch[epochId] = _totalRewardInEpoch;
        
        emit TotalRewardInEpochUpdated(epochId, _totalRewardInEpoch);
    }

    // public methods
    // public method to harvest all the unharvested epochs until current epoch - 1
    function massHarvest() external returns (uint256){
        uint256 totalDistributedValue;
        uint256 epochId = uint256(_getEpochId()).sub(1); // fails in epoch 0

        uint256 i;
        for (i = uint256(lastEpochIdHarvested[msg.sender]).add(1); i <= uint256(epochId); i++) {
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            totalDistributedValue = totalDistributedValue.add(_harvest(i.toUint128()));
        }

        emit MassHarvest(msg.sender, i.toUint128(), totalDistributedValue);

        if (totalDistributedValue > 0) {
            SafeERC20.safeTransferFrom(_slice, _vault, msg.sender, totalDistributedValue);
        }

        return totalDistributedValue;
    }

    function harvest (uint128 epochId) external returns (uint256){
        // checks for requested epoch
        require (_getEpochId() > epochId, "This epoch is in the future");
        require (uint256(lastEpochIdHarvested[msg.sender]).add(1) == uint256(epochId), "Harvest in order");
        uint256 userReward = _harvest(epochId);
        if (userReward > 0) {
            SafeERC20.safeTransferFrom(_slice, _vault, msg.sender, userReward);
        }
        emit Harvest(msg.sender, epochId, userReward);
        return userReward;
    }

    // views
    // calls to the staking smart contract to retrieve the epoch total pool size
    function getPoolSize(uint128 epochId) external view returns (uint256) {
        return _getPoolSize(epochId);
    }

    function getCurrentEpoch() external view returns (uint256) {
        return _getEpochId();
    }

    // calls to the staking smart contract to retrieve user balance for an epoch
    function getEpochStake(address userAddress, uint128 epochId) external view returns (uint256) {
        return _getUserBalancePerEpoch(userAddress, epochId);
    }

    function userLastEpochIdHarvested() external view returns (uint256){
        return lastEpochIdHarvested[msg.sender];
    }

    function getTotalAccruedRewards(address user) external view returns (uint256 rewards) {
        uint128 firstRewardableEpoch = (uint256(lastEpochIdHarvested[user]).add(1)).toUint128();
        uint128 currentEpoch = _getEpochId();

        if (firstRewardableEpoch == currentEpoch) return 0;

        for (uint128 i = firstRewardableEpoch; i < currentEpoch; i++) {
            rewards = rewards.add(totalRewardInEpoch[i]
                .mul(_getUserBalancePerEpoch(user, i))
                .div(_getPoolSize(i)));
        }
    }

    function initEpoch(uint128 epochId) external {
        require(_getEpochId() > epochId, "This epoch is in the future");
        _initEpoch(epochId);
    }

    // internal methods

    function _initEpoch(uint128 epochId) internal {
        require(uint256(lastInitializedEpoch).add(1) == uint256(epochId), "Epoch can be init only in order");
        lastInitializedEpoch = epochId;

        if ( totalRewardInEpoch[epochId] == 0) {
            totalRewardInEpoch[epochId] = totalRewardInEpoch[(uint256(epochId).sub(1)).toUint128()];
        }
        // call the staking smart contract to init the epoch
        epochs[epochId] = _getPoolSize(epochId);
    }

    function _harvest (uint128 epochId) internal returns (uint256) {
        // try to initialize an epoch. if it can't it fails
        // if it fails either user either a BarnBridge account will init not init epochs
        if (lastInitializedEpoch < epochId) {
            _initEpoch(epochId);
        }
        // Set user last harvested epoch
        lastEpochIdHarvested[msg.sender] = epochId;
        // compute and return user total reward. For optimization reasons the transfer have been moved to an upper layer (i.e. massHarvest needs to do a single transfer)

        // exit if there is no stake on the epoch
        if (epochs[epochId] == 0) {
            return 0;
        }

        uint256 reward = totalRewardInEpoch[epochId]
            .mul(_getUserBalancePerEpoch(msg.sender, epochId))
            .div(epochs[epochId]);

        totalRewardsDistributed = totalRewardsDistributed.add(reward);

        return reward;
    }

    function _getPoolSize(uint128 epochId) internal view returns (uint256) {
        // retrieve stable coins total staked in epoch

        return _staking.getEpochPoolSize(address(_stakableToken), epochId);
    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId) internal view returns (uint256){
        // retrieve stable coins total staked per user in epoch

        return _staking.getEpochUserBalance(userAddress, address(_stakableToken), epochId);
    }

    // compute epoch id from blocktimestamp and epochstart date
    function _getEpochId() internal view returns (uint128 epochId) {
        if (block.timestamp < epochStart) {
            return 0;
        }
        epochId = uint128(block.timestamp.sub(epochStart).div(epochDuration).add(1));
    }
}
