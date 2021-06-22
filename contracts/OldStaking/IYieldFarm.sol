// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;


interface IYieldFarm {

    function getCurrentEpoch() external view returns (uint); // get epoch id
    function totalRewardInEpoch(uint128 epoch) external view returns(uint);
    function epochStart() external view returns (uint);
    function epochDuration() external view returns (uint);
    function _vault() external view returns (address);
    function _slice() external view returns (address);
    function _staking() external view returns (address);
    function totalRewardsDistributed() external view returns (uint);
}