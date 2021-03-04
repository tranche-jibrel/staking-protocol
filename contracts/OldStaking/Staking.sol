// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "./IStaking.sol";
import "./StakingStorage.sol";


contract Staking is ReentrancyGuardUpgradeSafe, StakingStorage, IStaking {
    using SafeMath for uint256;

    /** 
     * @dev contract initialization
     * @param _startTime date and time to have staking contract working
     * @param _rewardCap reward cap
     * @param _withdrawBuffer blocks number to lock deposit / withdraw operations
     * @param _SLICEAddress slice contract token address
     */
    function initialize(uint256 _startTime, uint256 _rewardCap, uint256 _withdrawBuffer, address _SLICEAddress) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        __ReentrancyGuard_init_unchained();

        startTime = _startTime;
        rewardCap = _rewardCap;
        withdrawBuffer = _withdrawBuffer;
        SLICE = IERC20(_SLICEAddress);

        emit SLICEAddressUpdated(_SLICEAddress);
        emit RewardCapUpdated(_rewardCap);
        emit WithdrawBufferUpdated(_withdrawBuffer);
    }

    /** 
     * @dev check if a token is whitelisted
     * @param _token contract token address
     */
    modifier isTokenWhitelisted(address _token) {
        require(isWhitelisted[_token], "Staking: Token not whitelisted");
        _;
    }

    /** 
     * @dev check if distributed rewards are under a cap 
     */
    modifier withinCap() {
        require(rewardsDistributed < rewardCap, "Staking: Rewards have already been distributed :(");
        _;
    }

    /** 
     * @dev add a stackable contract address, along with its reward per block
     * @param _tokenAddress contract token address
     * @param _rewardPerBlock reward amount per block
     */
    function addStakableToken(address _tokenAddress, uint256 _rewardPerBlock) external onlyOwner {
        isWhitelisted[_tokenAddress] = true;
        rewardPerBlock[_tokenAddress] = _rewardPerBlock;
        
        emit TokenAddedToWhitelist(_tokenAddress, _rewardPerBlock);
    }

    /** 
     * @dev remove a stacked contract address, along with its reward per block
     * @param _tokenAddress contract token address
     */
    function removeStakableToken(address _tokenAddress) external isTokenWhitelisted(_tokenAddress) onlyOwner {
        delete isWhitelisted[_tokenAddress];
        delete rewardPerBlock[_tokenAddress];
        
        emit TokenRemovedFromWhitelist(_tokenAddress);
    }

    /** 
     * @dev update slice contract address
     * @param _tokenAddress contract token address
     */
    function updateSLICEAddress(address _tokenAddress) external onlyOwner {
        SLICE = IERC20(_tokenAddress);
        
        emit SLICEAddressUpdated(_tokenAddress);
    }

    /** 
     * @dev update reward cap
     * @param _rewardCap reward cap amount
     */
    function updateRewardCap(uint256 _rewardCap) external onlyOwner {
        rewardCap = _rewardCap;
        
        emit RewardCapUpdated(_rewardCap);
    }

    /** 
     * @dev update withdraw buffer
     * @param _withdrawBuffer withdraw buffer limit
     */
    function updateWithdrawBuffer(uint256 _withdrawBuffer) external onlyOwner {
        withdrawBuffer = _withdrawBuffer;
        
        emit WithdrawBufferUpdated(_withdrawBuffer);
    }

    /** 
     * @dev deposit an allowed token amount into staking contract
     * @param _tokenAddress contract token address
     * @param _amount deposit amount
     */
    function deposit(address _tokenAddress, uint256 _amount) external isTokenWhitelisted(_tokenAddress) withinCap() nonReentrant {
        require(now >= startTime, "Staking: Staking period hasn't started yet!");

        require(_amount > 0, "Staking: Amount must be > 0");

        uint256 allowance = IERC20(_tokenAddress).allowance(msg.sender, address(this));
        require(allowance >= _amount, "Staking: Token allowance too low");

        UserBalances storage userBalances = balances[msg.sender][_tokenAddress];

        uint256 recentReward = calculateRecentReward(_tokenAddress);

        if (recentReward > 0) {
            if (rewardsDistributed.add(recentReward) <= rewardCap) {
                userBalances.accruedRewards = (userBalances.accruedRewards).add(recentReward);
                rewardsDistributed = rewardsDistributed.add(recentReward);
            } else {
                userBalances.accruedRewards = (userBalances.accruedRewards).add(rewardCap.sub(rewardsDistributed));
                rewardsDistributed = rewardCap;
            }
        }

        userBalances.stakedAmount = (userBalances.stakedAmount).add(_amount);

        lastActivity[msg.sender] = block.number;

        // update the pool size
        poolSize[_tokenAddress] = poolSize[_tokenAddress].add(_amount);

        SafeERC20.safeTransferFrom(IERC20(_tokenAddress), msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _tokenAddress, _amount, userBalances.accruedRewards);
    }

    /** 
     * @dev withdraw amount of allowed token from staking contract, checking if a withdrawBuffer number blocks has passed
     * @param _tokenAddress contract token address
     * @param _amount withdraw amount
     */
    function withdraw(address _tokenAddress, uint256 _amount) external isTokenWhitelisted(_tokenAddress) nonReentrant {
        require((block.number).sub(lastActivity[msg.sender]) >= withdrawBuffer, "Staking: Withdraw buffer not met!");

        UserBalances storage userBalances = balances[msg.sender][_tokenAddress];

        require(userBalances.stakedAmount >= _amount, "Staking: balance too low");

        uint256 recentReward = calculateRecentReward(_tokenAddress);
        uint256 reward = recentReward.add(userBalances.accruedRewards);

        delete userBalances.accruedRewards;

        if (rewardsDistributed.add(recentReward) <= rewardCap) {
            rewardsDistributed = rewardsDistributed.add(recentReward);
        } else {
            rewardsDistributed = rewardCap;
        }

        userBalances.stakedAmount = userBalances.stakedAmount.sub(_amount);

        lastActivity[msg.sender] = block.number;

        // update the pool size
        poolSize[_tokenAddress] = poolSize[_tokenAddress].sub(_amount);

        SafeERC20.safeTransfer(IERC20(_tokenAddress), msg.sender, _amount);
        SafeERC20.safeTransfer(SLICE, msg.sender, reward);

        emit Withdraw(msg.sender, _tokenAddress, _amount, reward);
    }

    /** 
     * @dev calculate recent reward
     * @param _tokenAddress contract token address
     * @return reward amount
     */
    function calculateRecentReward(address _tokenAddress) private view returns (uint256 reward) {
        reward = ((rewardPerBlock[_tokenAddress].mul((block.number).sub(lastActivity[msg.sender]))).mul(balances[msg.sender][_tokenAddress].stakedAmount)).div(10**18);
    }

    /** 
     * @dev get total accrued interests for caller
     * @param _tokenAddress contract token address
     * @return reward amount
     */
    function getTotalReward(address _tokenAddress) public view returns (uint256 reward) {
        uint256 accruedRewards = balances[msg.sender][_tokenAddress].accruedRewards;
        reward = accruedRewards.add(calculateRecentReward(_tokenAddress));
    }

    /** 
     * @dev get the user staked amount in a particular token
     * @param _user user address
     * @param _token token contract address
     * @return the amount of `token` that the `user` has currently staked
     */
    function balanceOf(address _user, address _token) public view returns (uint256) {
        return balances[_user][_token].stakedAmount;
    }

    /** 
     * @dev get the pool size in a particular token
     * @param _tokenAddress token contract address
     * @return total amount of `tokenAddress` that was locked 
     */
    function getPoolSize(address _tokenAddress) public view returns (uint256) {
        return poolSize[_tokenAddress];
    }

}
