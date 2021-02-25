// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";


contract Staking is ReentrancyGuard, OwnableUpgradeSafe {
    using SafeMath for uint256;

    // timestamp for the start of staking period
    uint256 public startTime;

    // reward per block per token in SLICE
    mapping(address => uint256) public rewardPerBlock;

    // Total amount of SLICE tokens available for distribution as rewards for staking
    uint256 public rewardCap;

    // Total amount of SLICE tokens distributed
    uint256 public rewardsDistributed;

    // Minimum number of blocks after which the user can withdraw rewards
    uint256 public withdrawBuffer;

    IERC20 public SLICE;

    struct UserBalances {
        uint256 stakedAmount;
        uint256 accruedRewards;
    }

    // holds the current balance of the user for each token
    mapping(address => mapping(address => UserBalances)) private balances;

    // for each token, we store the total pool size
    mapping(address => uint256) private poolSize;

    // last block number where the user withdrew/deposited tokens
    mapping(address => uint256) private lastActivity;

    // returns true if token is whitelisted i.e it can be staked
    mapping(address => bool) public isWhitelisted;

    event Deposit(address indexed user, address indexed tokenAddress, uint256 stakedAmount, uint256 accruedRewards);
    event Withdraw(address indexed user, address indexed tokenAddress, uint256 amount, uint256 reward);
    event TokenAddedToWhitelist(address indexed newTokenAddress, uint256 rewardPerBlock);
    event TokenRemovedFromWhitelist(address tokenAddress);
    event SLICEAddressUpdated(address tokenAddress);
    event RewardCapUpdated(uint256 newRewardCap);
    event WithdrawBufferUpdated(uint256 newWithdrawBuffer);

    modifier isTokenWhitelisted(address _token) {
        require(isWhitelisted[_token], "Staking: Token not whitelisted");
        _;
    }

    modifier withinCap() {
        require(rewardsDistributed < rewardCap, "Staking: Rewards have already been distributed :(");
        _;
    }

    function initialize(uint256 _startTime, uint256 _rewardCap, uint256 _withdrawBuffer, address _SLICEAddress) external initializer {
        OwnableUpgradeSafe.__Ownable_init();

        startTime = _startTime;
        rewardCap = _rewardCap;
        withdrawBuffer = _withdrawBuffer;
        SLICE = IERC20(_SLICEAddress);

        emit SLICEAddressUpdated(_SLICEAddress);
        emit RewardCapUpdated(_rewardCap);
        emit WithdrawBufferUpdated(_withdrawBuffer);
    }

    function addStakableToken(address tokenAddress, uint256 _rewardPerBlock) external onlyOwner {
        isWhitelisted[tokenAddress] = true;
        rewardPerBlock[tokenAddress] = _rewardPerBlock;
        
        emit TokenAddedToWhitelist(tokenAddress, _rewardPerBlock);
    }

    function removeStakableToken(address tokenAddress) external isTokenWhitelisted(tokenAddress) onlyOwner {
        delete isWhitelisted[tokenAddress];
        delete rewardPerBlock[tokenAddress];
        
        emit TokenRemovedFromWhitelist(tokenAddress);
    }

    function updateSLICEAddress(address tokenAddress) external onlyOwner {
        SLICE = IERC20(tokenAddress);
        
        emit SLICEAddressUpdated(tokenAddress);
    }

    function updateRewardCap(uint256 _rewardCap) external onlyOwner {
        rewardCap = _rewardCap;
        
        emit RewardCapUpdated(_rewardCap);
    }

    function updateWithdrawBuffer(uint256 _withdrawBuffer) external onlyOwner {
        withdrawBuffer = _withdrawBuffer;
        
        emit WithdrawBufferUpdated(_withdrawBuffer);
    }

    function deposit(address tokenAddress, uint256 amount) external isTokenWhitelisted(tokenAddress) withinCap() nonReentrant {
        require(now >= startTime, "Staking: Staking period hasn't started yet!");

        require(amount > 0, "Staking: Amount must be > 0");

        uint256 allowance = IERC20(tokenAddress).allowance(msg.sender, address(this));
        require(allowance >= amount, "Staking: Token allowance too low");

        UserBalances storage userBalances = balances[msg.sender][tokenAddress];

        uint256 recentReward = calculateRecentReward(tokenAddress);

        if (recentReward > 0) {
            if (rewardsDistributed.add(recentReward) <= rewardCap) {
                userBalances.accruedRewards = (userBalances.accruedRewards).add(recentReward);
                rewardsDistributed = rewardsDistributed.add(recentReward);
            } else {
                userBalances.accruedRewards = (userBalances.accruedRewards).add(rewardCap.sub(rewardsDistributed));
                rewardsDistributed = rewardCap;
            }
        }

        userBalances.stakedAmount = (userBalances.stakedAmount).add(amount);

        lastActivity[msg.sender] = block.number;

        // update the pool size
        poolSize[tokenAddress] = poolSize[tokenAddress].add(amount);

        SafeERC20.safeTransferFrom(IERC20(tokenAddress), msg.sender, address(this), amount);

        emit Deposit(msg.sender, tokenAddress, amount, userBalances.accruedRewards);
    }


    function withdraw(address tokenAddress, uint256 amount) external isTokenWhitelisted(tokenAddress) nonReentrant {
        require((block.number).sub(lastActivity[msg.sender]) >= withdrawBuffer, "Staking: Withdraw buffer not met!");

        UserBalances storage userBalances = balances[msg.sender][tokenAddress];

        require(userBalances.stakedAmount >= amount, "Staking: balance too low");

        uint256 recentReward = calculateRecentReward(tokenAddress);
        uint256 reward = recentReward.add(userBalances.accruedRewards);

        delete userBalances.accruedRewards;

        if (rewardsDistributed.add(recentReward) <= rewardCap) {
            rewardsDistributed = rewardsDistributed.add(recentReward);
        } else {
            rewardsDistributed = rewardCap;
        }

        userBalances.stakedAmount = userBalances.stakedAmount.sub(amount);

        lastActivity[msg.sender] = block.number;

        // update the pool size
        poolSize[tokenAddress] = poolSize[tokenAddress].sub(amount);

        SafeERC20.safeTransfer(IERC20(tokenAddress), msg.sender, amount);
        SafeERC20.safeTransfer(SLICE, msg.sender, reward);

        emit Withdraw(msg.sender, tokenAddress, amount, reward);
    }

    function calculateRecentReward(address tokenAddress) private view returns (uint256 reward) {
        reward = ((rewardPerBlock[tokenAddress].mul((block.number).sub(lastActivity[msg.sender]))).mul(balances[msg.sender][tokenAddress].stakedAmount)).div(10**18);
    }

    function getTotalReward(address tokenAddress) public view returns (uint256 reward) {
        uint256 accruedRewards = balances[msg.sender][tokenAddress].accruedRewards;
        reward = accruedRewards.add(calculateRecentReward(tokenAddress));
    }

    /*
     * Returns the amount of `token` that the `user` has currently staked
     */
    function balanceOf(address user, address token) public view returns (uint256) {
        return balances[user][token].stakedAmount;
    }

    /*
     * Returns the total amount of `tokenAddress` that was locked from beginning to end of epoch identified by `epochId`
     */
    function getPoolSize(address tokenAddress) public view returns (uint256) {
        return poolSize[tokenAddress];
    }

}
