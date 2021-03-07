// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;


contract StakingMilestonesMock {

    mapping (address => mapping (address => mapping (uint128 => uint))) internal epochUserBalance;
    mapping (address => mapping (uint128 => uint)) internal epochPoolSize;

    uint public epoch1Start;
    uint public epochDuration;

    constructor(uint _epoch1Start, uint _epochDuration) public {
        epoch1Start = _epoch1Start;
        epochDuration = _epochDuration;
    }

    function getEpochId(uint timestamp) external view returns (uint) {
        if (timestamp < epoch1Start) {
            return 0;
        }

        return uint128((timestamp - epoch1Start) / epochDuration + 1);
    }

    function setEpochUserBalance(address user, address token, uint128 epoch, uint balance) external {
        epochUserBalance[user][token][epoch] = balance;
    }

    function getEpochUserBalance(address user, address token, uint128 epoch) external view returns(uint) {
        return epochUserBalance[user][token][epoch];
    }

    function setEpochPoolSize(address token, uint128 epoch, uint size) external {
        epochPoolSize[token][epoch] = size;
    }

    function getEpochPoolSize(address token, uint128 epoch) external view returns (uint) {
        return epochPoolSize[token][epoch];
    }
}