// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./ERC20NonTransferrable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";


contract StakingWithLockup is OwnableUpgradeSafe, ERC20NonTransferrableUpgradeSafe {

    // lib
    using SafeMath for uint;

    // addreses
    // contracts
    address public _vault;
    IERC20 public _slice;
    IERC20 public _stakableToken;

    // Different durations in which a user will receive rewards
    mapping (uint8 => uint256) public durations;

    uint8 public numDurations;

    mapping (uint8 => uint256) public percentageRewards; // Percentage yield corresponding to all reward durations. 100 = 1%, 10000 = 100%
    mapping (uint8 => uint256) public rewardCapForDuration; // Total reward we want to distribute corresponding to each duration
    mapping (uint8 => uint256) public totalRewardsDistributedForDuration; // Total reward distributed corresponding to each duration

    struct StakingDetails {
        uint256 startTime;
        uint256 amount;
        uint256 endTime;
        uint256 reward;
    }

    mapping (address => uint256) public stakeCounter;
    mapping (address => mapping (uint256 => StakingDetails)) public stakingDetails;

    // Total SLICE distributed as rewards
    uint256 public totalRewardsDistributed;

    // events
    event Staked(address indexed user, uint256 amount, uint256 startTime, uint256 endTime, uint256 counter, uint256 tokensMinted);
    event Claimed(address indexed user, uint256 amount, uint256 reward, uint256 tokensBurned, uint256 counter);
    event RewardsSet(uint256[] rewards);
    event RewardCapsSet(uint256[] caps);
    event RewardDurationsSet(uint256[] _durations);

    // constructor
    function initialize(
        address vault,
        address slice,
        address stakableToken,
        uint256[] calldata rewardsForDuration,
        uint256[] calldata rewardCapsForDuration,
        uint256[] calldata rewardDurations,
        string memory name,
        string memory symbol
    ) external initializer {

        OwnableUpgradeSafe.__Ownable_init();
        ERC20NonTransferrableUpgradeSafe.__ERC20_init(name, symbol);
        
        require(rewardsForDuration.length == rewardCapsForDuration.length, "StakingWithLockup: Array lengths should be equal");
        require(rewardDurations.length == rewardCapsForDuration.length, "StakingWithLockup: Array lengths should be equal");

        numDurations = uint8(rewardsForDuration.length);

        for (uint8 i = 0; i < numDurations; i++) {
            percentageRewards[i] = rewardsForDuration[i];
            rewardCapForDuration[i] = rewardCapsForDuration[i];
            durations[i] = rewardDurations[i];
        }

        _slice = IERC20(slice);
        _stakableToken = IERC20(stakableToken);
        _vault = vault;

        emit RewardDurationsSet(rewardDurations);
        emit RewardsSet(rewardsForDuration);
        emit RewardCapsSet(rewardCapsForDuration);

    }

    function setRewardDetails
        (
            uint256[] calldata rewardDurations,
            uint256[] calldata rewardCapsForDuration,
            uint256[] calldata rewardsForDuration
        )
            external
            onlyOwner
        {

        require(rewardDurations.length == rewardCapsForDuration.length, "StakingWithLockup: Array lengths should be equal");
        require(rewardsForDuration.length == rewardCapsForDuration.length, "StakingWithLockup: Array lengths should be equal");

        numDurations = uint8(rewardsForDuration.length);

        for (uint8 i = 0; i < numDurations; i++) {
            durations[i] = rewardDurations[i];
            percentageRewards[i] = rewardsForDuration[i];
            rewardCapForDuration[i] = rewardCapsForDuration[i];
        }

        emit RewardDurationsSet(rewardDurations);
        emit RewardCapsSet(rewardCapsForDuration);
        emit RewardsSet(rewardsForDuration);

    }

    function stake(uint256 amount, uint8 durationIndex) external {

        require(amount > 0, "StakingWithLockup: Cannot stake 0 tokens");
        require(durationIndex < numDurations, "StakingWithLockup: Please enter valid staking duration index");
        require(totalRewardsDistributedForDuration[durationIndex] < rewardCapForDuration[durationIndex],
                "StakingWithLockup: Rewards allocated for this duration have been distributed");

        uint256 stakeAmount = amount;
        uint256 reward = stakeAmount.mul(percentageRewards[durationIndex]).div(10000); // 10000 = 100%

        if (totalRewardsDistributedForDuration[durationIndex].add(reward) > rewardCapForDuration[durationIndex]) {
            
            reward = rewardCapForDuration[durationIndex].sub(totalRewardsDistributedForDuration[durationIndex]);
            
            stakeAmount = reward.mul(10000).div(percentageRewards[durationIndex]);

            totalRewardsDistributedForDuration[durationIndex] = rewardCapForDuration[durationIndex];
        
        } else {

            totalRewardsDistributedForDuration[durationIndex] = totalRewardsDistributedForDuration[durationIndex].add(reward);
        
        }

        stakeCounter[msg.sender] = stakeCounter[msg.sender].add(1);

        StakingDetails storage details = stakingDetails[msg.sender][stakeCounter[msg.sender]];

        details.startTime = block.timestamp;
        details.endTime = block.timestamp.add(durations[durationIndex]);
        details.amount = stakeAmount;
        details.reward = reward;

        _mint(msg.sender, stakeAmount.add(reward));

        SafeERC20.safeTransferFrom(_stakableToken, msg.sender, address(this), stakeAmount);

        emit Staked(msg.sender, stakeAmount, block.timestamp, details.endTime, stakeCounter[msg.sender], stakeAmount.add(reward));

    }

    function claim(uint256 counter) external {
        _claim(counter);
    }

    function massClaim(uint256[] calldata counters) external {
        for (uint256 i = 0; i < counters.length; i++) {
            _claim(counters[i]);
        }
    }

    function _claim(uint256 counter) internal {
        require(stakingDetails[msg.sender][counter].amount > 0, "StakingWithLockup: Stake does not exist");
        require(block.timestamp >= stakingDetails[msg.sender][counter].endTime, "StakingWithLockup: Cannot claim reward before endTime");

        uint256 reward = stakingDetails[msg.sender][counter].reward;
        uint256 amount = stakingDetails[msg.sender][counter].amount;

        delete stakingDetails[msg.sender][counter];

        totalRewardsDistributed = totalRewardsDistributed.add(reward);

        _burn(msg.sender, amount.add(reward));

        SafeERC20.safeTransfer(_stakableToken, msg.sender, amount);
        SafeERC20.safeTransferFrom(_slice, _vault, msg.sender, reward);
        
        emit Claimed(msg.sender, amount, reward, amount.add(reward), counter);
    }

}
