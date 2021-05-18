// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "../StakingMilestones/StakingRewards.sol";


contract StakingRewardsMock is StakingRewards {

    function setRewardDurations(uint256[] calldata durations) external {
        require(durations.length == 5, "Invalid array length");

        rewardDuration1 = durations[0];
        rewardDuration2 = durations[1];
        rewardDuration3 = durations[2];
        rewardDuration4 = durations[3];
        rewardDuration5 = durations[4];
    }
}
