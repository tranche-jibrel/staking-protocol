// Inspired by https://github.com/BarnBridge/BarnBridge-YieldFarming/blob/master/contracts/YieldFarm.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "./IStakingMilestones.sol";


contract YieldFarmLP is OwnableUpgradeSafe {
    using SafeMath for uint256;
    using SafeCast for uint256;

    address public _vault;
    IERC20 public _slice;
    IStakingMilestones public _staking;

    // Stakable token details
    mapping (address => uint256) public weightOfStakableToken;
    uint128 public noOfStakableTokens;
    mapping (uint128 => address) public stakableToken;

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
    event StakableTokenAdded(address indexed newTokenAddress, uint256 weight);
    event StakableTokenRemoved(address indexed tokenAddress);
    event TotalRewardInEpochUpdated(uint128 epochId, uint256 totalReward);

    // constructor
    function initialize(
        address sliceAddress,
        address stakeContract,
        address vault,
        uint256 _totalRewardInEpoch
    ) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        _slice = IERC20(sliceAddress);
        totalRewardInEpoch[1] = _totalRewardInEpoch;
        _staking = IStakingMilestones(stakeContract);
        _vault = vault;
        epochStart = _staking.epoch1Start();
        epochDuration = _staking.epochDuration();
    }

    /** 
     * @dev add a stakable token contract address, along with its weight
     * @param _tokenAddress contract token address
     * @param _weight weight of the token in percent for calculating rewards
     */
    function addStakableToken(address _tokenAddress, uint256 _weight) external onlyOwner {
        require(weightOfStakableToken[_tokenAddress] == 0, "YieldFarm: Token already added");

        noOfStakableTokens = (uint256(noOfStakableTokens).add(1)).toUint128();
        weightOfStakableToken[_tokenAddress] = _weight;
        stakableToken[noOfStakableTokens] = _tokenAddress;
        
        emit StakableTokenAdded(_tokenAddress, _weight);
    }

    /** 
     * @dev remove a stakable token contract address, along with its weight
     * @param _tokenAddress contract token address
     */
    function removeStakableToken(address _tokenAddress) external onlyOwner {
        require(weightOfStakableToken[_tokenAddress] > 0, "YieldFarm: Token is not added");

        delete weightOfStakableToken[_tokenAddress];

        uint128 i;
        for (i = 1; i <= noOfStakableTokens; i++) {
            if (stakableToken[i] == _tokenAddress) {
                stakableToken[i] = stakableToken[noOfStakableTokens];
                stakableToken[noOfStakableTokens] = address(0); 
                break;
            }
        }

        noOfStakableTokens = (uint256(noOfStakableTokens).sub(1).toUint128());
        
        emit StakableTokenRemoved(_tokenAddress);
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

    function getTotalAccruedRewardsForToken(address user, address token) external view returns (uint256 rewards) {
        uint128 firstRewardableEpoch = (uint256(lastEpochIdHarvested[user]).add(1)).toUint128();
        uint128 currentEpoch = _getEpochId();

        if (firstRewardableEpoch == currentEpoch) return 0;

        for (uint128 i = firstRewardableEpoch; i < currentEpoch; i++) {
            rewards = rewards.add(totalRewardInEpoch[i]
                .mul(((_staking.getEpochUserBalance(user, token, i)).mul(weightOfStakableToken[token])).div(100))
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
        // retrieve normalised stable coins total staked in epoch
        uint256 size;
        address token;
        for (uint128 i = 1; i <= noOfStakableTokens; i++) {
            token = stakableToken[i];
            size = size.add(((_staking.getEpochPoolSize(token, epochId)).mul(weightOfStakableToken[token])).div(100));
        }

        return size;
    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId) internal view returns (uint256){
        // retrieve normalised stable coins total staked per user in epoch
        uint256 balance;
        address token;
        for (uint128 i = 1; i <= noOfStakableTokens; i++) {
            token = stakableToken[i];
            balance = balance.add(((_staking.getEpochUserBalance(userAddress, token, epochId)).mul(weightOfStakableToken[token])).div(100));
        }

        return balance;
    }

    // compute epoch id from blocktimestamp and epochstart date
    function _getEpochId() internal view returns (uint128 epochId) {
        if (block.timestamp < epochStart) {
            return 0;
        }
        epochId = uint128(block.timestamp.sub(epochStart).div(epochDuration).add(1));
    }
}
