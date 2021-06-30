require('dotenv').config();
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

var StakingWithLockup = artifacts.require('./StakingMilestones/StakingWithLockup.sol');
var Vault = artifacts.require('./StakingMilestones/Vault.sol');
var mySlice = artifacts.require('./test/MySlice.sol');
var myDai = artifacts.require('./test/MyERC20.sol');

const totalReward = "10000";
module.exports = async (deployer, network, accounts) => {
  if (network == "development") {
    const tokenOwner = accounts[0];

    const mySliceInstance = await deployProxy(mySlice, [1000000, "mySlice", "SLICE"], { from: tokenOwner });
    console.log('mySlice Deployed: ', mySliceInstance.address);

    const myDaiInstance = await deployProxy(myDai, [10000000, "myDai", "DAI"], { from: tokenOwner });
    console.log('myDai Deployed: ', myDaiInstance.address);

    const vaultInstance = await deployer.deploy(Vault, mySliceInstance.address, { from: tokenOwner });
    console.log('Vault deployed: ' + vaultInstance.address)
    /*
        const stakingLockupInstance = await deployProxy(StakingWithLockup, [
          vaultInstance.address,
          mySliceInstance.address,
          myDai.address,
          [1000, 2000, 3000], // 10%, 20%, 30%
          [web3.utils.toWei('200000'), web3.utils.toWei('300000'), web3.utils.toWei('500000')],
          ["15768000", "31536000", "63072000"], // 6 month, 1 year, 2 year
          "SLICE STAKE",
          "SLICE_STAKE"
        ], { from: tokenOwner, unsafeAllowCustomTypes: true });
    */

    const stakingLockupInstance = await deployProxy(StakingWithLockup, [
      vaultInstance.address,
      mySliceInstance.address,
      myDai.address,
      [web3.utils.toWei("0.1"), web3.utils.toWei("0.2"), web3.utils.toWei("0.3"), web3.utils.toWei("0.4"), web3.utils.toWei("0.5")],
      [web3.utils.toWei("1"), web3.utils.toWei("2"), web3.utils.toWei("3"), web3.utils.toWei("4"), web3.utils.toWei("5")],
      [10, 20, 30, 40, 50],
      "Stake Token",
      "STK",
    ], { from: tokenOwner });

    console.log('STAKING_LOCKUP_CONTRACT=' + stakingLockupInstance.address);

    await vaultInstance.setAllowance(stakingLockupInstance.address, web3.utils.toWei(totalReward), { from: tokenOwner });

    await mySliceInstance.transfer(vaultInstance.address, web3.utils.toWei(totalReward), { from: tokenOwner });

  } else if (network == 'kovan') {
    let { SLICEAddress, VAULT_ADDRESS, } = process.env;
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    let stakingLockupInstance = await deployProxy(StakingWithLockup, [
      VAULT_ADDRESS,
      SLICEAddress,
      SLICEAddress,
      [web3.utils.toWei("0.008333"), web3.utils.toWei("0.1250"), web3.utils.toWei("0.4")],
      [web3.utils.toWei('1000'), web3.utils.toWei('20000'), web3.utils.toWei('250000')],
      ["120", "300", "360"], // 1 month, 6 month, 1 year
      "SLICE STAKE_27_JUNE",
      "SLICE_STAKE_27_JUNE"
    ], { from: tokenOwner });
    console.log('STAKING_LOCKUP_CONTRACT=' + stakingLockupInstance.address);
    let VaultInstance = await Vault.at(VAULT_ADDRESS);
    await VaultInstance.setAllowance(stakingLockupInstance.address, web3.utils.toWei(totalReward), { from: tokenOwner });

  } else if (network == 'mainnet') {
    let { SLICEAddress, VAULT_ADDRESS } = process.env;
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    console.log('control in deploying staking lockup', SLICEAddress, VAULT_ADDRESS);
    let reward1 = 12500;
    let reward2 = 156250;
    let reward3 = 500000;
    let duration1 = 60 * 60 * 24 * 31;
    let duration2 = 60 * 60 * 24 * 183;
    let duration3 = 60 * 60 * 24 * 365;
    let totalRewards = reward1 + reward2 + reward3;
    let stakingLockupInstance = await deployProxy(StakingWithLockup, [
      VAULT_ADDRESS,
      SLICEAddress,
      SLICEAddress,
      [web3.utils.toWei("0.008333"), web3.utils.toWei("0.1250"), web3.utils.toWei("0.4")], // 10%, 25%, 40%
      [web3.utils.toWei(reward1.toString()), web3.utils.toWei(reward2.toString()), web3.utils.toWei(reward3.toString())],
      [duration1.toString(), duration2.toString(), duration3.toString()], // 1 month(31), 6 month(183), 1 year(365)
      "Staked SLICE",
      "STKDSLICE"
    ], { from: tokenOwner });
    console.log('STAKING_LOCKUP_CONTRACT=' + stakingLockupInstance.address);
    let VaultInstance = await Vault.at(VAULT_ADDRESS);
    await VaultInstance.setAllowance(stakingLockupInstance.address, web3.utils.toWei(totalRewards.toString()), { from: tokenOwner });
    console.log('Vault allowance set');
  }

};
