// Inspired by https://github.com/BarnBridge/BarnBridge-YieldFarming/blob/master/contracts/YieldFarm.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IStakingMilestones.sol";


contract YieldFarm is Ownable {

    // lib
    using SafeMath for uint;
    using SafeMath for uint128;

    // constants
    uint public constant NR_OF_EPOCHS = 25;

     // state variables

    uint public rewardCap;

    // addreses
    address private _vault;
    // contracts
    IERC20 private _slice;
    IStakingMilestones private _staking;

    // Stakable token details
    mapping (address => uint) public weightOfStakableToken;
    uint128 public noOfStakableTokens;
    mapping (uint128 => address) public stakableToken;

    // fixed size array holdings total number of epochs + 1 (epoch 0 doesn't count)
    uint[] private epochs = new uint[](NR_OF_EPOCHS + 1);
    // pre-computed variable for optimization. total amount of bond tokens to be distributed on each epoch
    uint private _totalAmountPerEpoch;

    // id of last init epoch, for optimization purposes moved from struct to a single id.
    uint128 public lastInitializedEpoch;

    // state of user harvest epoch
    mapping(address => uint128) private lastEpochIdHarvested;
    uint public epochDuration; // init from staking contract
    uint public epochStart; // init from staking contract

    // events
    event MassHarvest(address indexed user, uint256 epochsHarvested, uint256 totalValue);
    event Harvest(address indexed user, uint128 indexed epochId, uint256 amount);
    event StakableTokenAdded(address indexed newTokenAddress, uint256 weight);
    event StakableTokenRemoved(address indexed tokenAddress);

    // constructor
    constructor(
        address sliceAddress,
        address stakeContract,
        address vault
        uint _rewardCap) public {
        _slice = IERC20(sliceAddress);
        rewardCap = _rewardCap;
        _staking = IStakingMilestones(stakeContract);
        _vault = vault;
        epochStart = _staking.epoch1Start();
        epochDuration = _staking.epochDuration();
        _totalAmountPerEpoch = rewardCap.mul(10**18).div(NR_OF_EPOCHS);
    }

    /** 
     * @dev add a stakable token contract address, along with its weight
     * @param _tokenAddress contract token address
     * @param _weight weight of the token in percent for calculating rewards
     */
    function addStakableToken(address _tokenAddress, uint _weight) external onlyOwner {
        require(weightOfStakableToken[_tokenAddress] == 0, "YieldFarm: Token already added");

        noOfStakableTokens = noOfStakableTokens.add(1);
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

        uint128 index;

        for (uint128 i = 1; i <= noOfStakableTokens; i++) {
            if (stakableToken[i] == _tokenAddress) index = i;
        }

        for (uint128 j = index; j <= noOfStakableTokens; j++) {
            if (j != noOfStakableTokens) {
                stakableToken[j] = stakableToken[j + 1];
            } else {
                delete stakableToken[j];
            }
        }

        noOfStakableTokens = noOfStakableTokens.sub(1);
        
        emit StakableTokenRemoved(_tokenAddress);
    }

    // public methods
    // public method to harvest all the unharvested epochs until current epoch - 1
    function massHarvest() external returns (uint){
        uint totalDistributedValue;
        uint epochId = _getEpochId().sub(1); // fails in epoch 0
        // force max number of epochs
        if (epochId > NR_OF_EPOCHS) {
            epochId = NR_OF_EPOCHS;
        }

        for (uint128 i = lastEpochIdHarvested[msg.sender] + 1; i <= epochId; i++) {
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            totalDistributedValue += _harvest(i);
        }

        emit MassHarvest(msg.sender, epochId.sub(lastEpochIdHarvested[msg.sender]), totalDistributedValue);

        if (totalDistributedValue > 0) {
            _slice.transferFrom(_vault, msg.sender, totalDistributedValue);
        }

        return totalDistributedValue;
    }

    function harvest (uint128 epochId) external returns (uint){
        // checks for requested epoch
        require (_getEpochId() > epochId, "This epoch is in the future");
        require(epochId <= NR_OF_EPOCHS, "Maximum number of epochs is 25");
        require (lastEpochIdHarvested[msg.sender].add(1) == epochId, "Harvest in order");
        uint userReward = _harvest(epochId);
        if (userReward > 0) {
            _slice.transferFrom(_vault, msg.sender, userReward);
        }
        emit Harvest(msg.sender, epochId, userReward);
        return userReward;
    }

    // views
    // calls to the staking smart contract to retrieve the epoch total pool size
    function getPoolSize(uint128 epochId) external view returns (uint) {
        return _getPoolSize(epochId);
    }

    function getCurrentEpoch() external view returns (uint) {
        return _getEpochId();
    }

    // calls to the staking smart contract to retrieve user balance for an epoch
    function getEpochStake(address userAddress, uint128 epochId) external view returns (uint) {
        return _getUserBalancePerEpoch(userAddress, epochId);
    }

    function userLastEpochIdHarvested() external view returns (uint){
        return lastEpochIdHarvested[msg.sender];
    }

    // internal methods

    function _initEpoch(uint128 epochId) internal {
        require(lastInitializedEpoch.add(1) == epochId, "Epoch can be init only in order");
        lastInitializedEpoch = epochId;
        // call the staking smart contract to init the epoch
        epochs[epochId] = _getPoolSize(epochId);
    }

    function _harvest (uint128 epochId) internal returns (uint) {
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

        return _totalAmountPerEpoch
        .mul(_getUserBalancePerEpoch(msg.sender, epochId))
        .div(epochs[epochId]);
    }

    function _getPoolSize(uint128 epochId) internal view returns (uint) {
        // retrieve normalised stable coins total staked in epoch
        uint size;
        address token;
        for (uint128 i = 1; i <= noOfStakableTokens; i++) {
            token = stakableToken[i];
            size = size.add(((_staking.getEpochPoolSize(token, epochId)).mul(weightOfStakableToken[token])).div(100));
        }

        return size;
    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId) internal view returns (uint){
        // retrieve normalised stable coins total staked per user in epoch
        uint balance;
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
