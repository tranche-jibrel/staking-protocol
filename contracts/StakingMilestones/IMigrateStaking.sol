// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

// if we need to define an interface to work with Migrate Staking contract from another contract
interface IMigrateStaking {

    struct NewStakingDetails {
        uint256 startTime;
        uint256 amount;
        uint256 endTime;
        uint256 reward;
    }

    // some functions can be inserted here to work with them from another contract

}