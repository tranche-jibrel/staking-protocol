// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";


contract StakingStorage is OwnableUpgradeSafe {
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
    mapping(address => mapping(address => UserBalances)) public balances;

    // for each token, we store the total pool size
    mapping(address => uint256) public poolSize;

    // last block number where the user withdrew/deposited tokens
    mapping(address => uint256) public lastActivity;

    // returns true if token is whitelisted i.e it can be staked
    mapping(address => bool) public isWhitelisted;

}
