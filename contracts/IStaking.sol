// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

interface IStaking {
    event Deposit(address indexed user, address indexed tokenAddress, uint256 stakedAmount, uint256 accruedRewards);
    event Withdraw(address indexed user, address indexed tokenAddress, uint256 amount, uint256 reward);
    event TokenAddedToWhitelist(address indexed newTokenAddress, uint256 rewardPerBlock);
    event TokenRemovedFromWhitelist(address tokenAddress);
    event SLICEAddressUpdated(address tokenAddress);
    event RewardCapUpdated(uint256 newRewardCap);
    event WithdrawBufferUpdated(uint256 newWithdrawBuffer);
}