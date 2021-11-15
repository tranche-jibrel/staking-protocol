// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "./StakingWithLockup.sol";
import "./IMigrateStaking.sol";

contract MigrateStaking is StakingWithLockup, IMigrateStaking {
    using SafeMath for uint;

    mapping (address => uint256) public newStakeCounter;
    mapping (address => mapping (uint256 => NewStakingDetails)) public newStakingDetails;

    address public stkFactory;

    function initialize(address _factory) public initializer {
        stkFactory = _factory;
    }

    // durationIndex can be linked to a new staking contract address deployed by the factory 
    // this function can be restricted to onlyOwner or it can be called by users to "migrate" their details...
    function getSingleStakingDetail(address _sender, uint8 _durationIdx, address _newStkAddress) external {
        uint256 nStakes = stakeCounter[_sender];
        if (nStakes > 0) {
            for (uint256 i = 1; i <= nStakes; i++) {
                StakingDetails memory stkDtls = stakingDetails[_sender][stakeCounter[_sender]];
                // new details can be inserted directly inside the new staking contract!!
                if (stkDtls.durationIndex == _durationIdx){
                    newStakeCounter[_sender] = newStakeCounter[_sender].add(1);
                    NewStakingDetails storage newDetails = newStakingDetails[_sender][newStakeCounter[_sender]];
                    newDetails.startTime = stkDtls.startTime;
                    newDetails.endTime = stkDtls.endTime;
                    newDetails.amount = stkDtls.amount;
                    newDetails.reward = stkDtls.reward;

                    // eventually we can burn tokens from user wallet
                    //_burn(msg.sender, (newDetails.amount).add(newDetails.reward));
                }
            }
        }
    }

    // function to be called to migrate values from old to new contract
    function migrateValues(address _newStkAddress, uint256 _amountToTrasfer) external onlyOwner {
        SafeERC20.safeTransfer(_stakableToken, _newStkAddress, _amountToTrasfer);
    }

}