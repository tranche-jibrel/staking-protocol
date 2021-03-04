// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


interface IYieldFarm {
    function massHarvest(address beneficiary) external returns (uint);
}