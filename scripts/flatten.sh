#!/usr/bin/env zsh

# This scripts can be used to create flat files which can be directly imported on Remix if needed.
echo "Clearing existing flats"
if [ -d dist ]; then
    rm -rf dist
fi

mkdir dist
# TO-DO: Comments (author, summary, Created On) should be handled better.

# Staking
echo "Flattening # Staking contract"
npx truffle-flattener ./contracts/OldStaking/Staking.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' | awk '/pragma solidity/&&c++>0 {next} 1' | awk '/author/&&c++>0 {next} 1' | awk '/summary/&&c++>0 {next} 1' | awk '/Created on/&&c++>0 {next}  1' | sed '/^[[:blank:]]*\/\/ File/d;s/#.*//' >./dist/Staking.sol

# StakingMilestones
echo "Flattening # StakingMilestones contract"
npx truffle-flattener ./contracts/StakingMilestones/StakingMilestones.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' | awk '/pragma solidity/&&c++>0 {next} 1' | awk '/author/&&c++>0 {next} 1' | awk '/summary/&&c++>0 {next} 1' | awk '/Created on/&&c++>0 {next}  1' | sed '/^[[:blank:]]*\/\/ File/d;s/#.*//' >./dist/StakingMilestones.sol

# YieldFarm
echo "Flattening # YieldFarm contract"
npx truffle-flattener ./contracts/StakingMilestones/YieldFarm.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' | awk '/pragma solidity/&&c++>0 {next} 1' | awk '/author/&&c++>0 {next} 1' | awk '/summary/&&c++>0 {next} 1' | awk '/Created on/&&c++>0 {next}  1' | sed '/^[[:blank:]]*\/\/ File/d;s/#.*//' >./dist/YieldFarm.sol

# Vault
echo "Flattening # Vault contract"
npx truffle-flattener ./contracts/StakingMilestones/Vault.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' | awk '/pragma solidity/&&c++>0 {next} 1' | awk '/author/&&c++>0 {next} 1' | awk '/summary/&&c++>0 {next} 1' | awk '/Created on/&&c++>0 {next}  1' | sed '/^[[:blank:]]*\/\/ File/d;s/#.*//' >./dist/Vault.sol


# Staking Lockup
echo "Flattening # Staking Lockup"
npx truffle-flattener ./contracts/StakingMilestones/StakingWithLockup.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' | awk '/pragma solidity/&&c++>0 {next} 1' | awk '/author/&&c++>0 {next} 1' | awk '/summary/&&c++>0 {next} 1' | awk '/Created on/&&c++>0 {next}  1' | sed '/^[[:blank:]]*\/\/ File/d;s/#.*//' >./dist/StakingWithLockup.sol


# MyERC20
echo "Flattening # MyERC20 contract"
npx truffle-flattener ./contracts/test/MyERC20.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' | awk '/pragma solidity/&&c++>0 {next} 1' | awk '/author/&&c++>0 {next} 1' | awk '/summary/&&c++>0 {next} 1' | awk '/Created on/&&c++>0 {next}  1' | sed '/^[[:blank:]]*\/\/ File/d;s/#.*//' >./dist/MyERC20.sol
