require('dotenv').config();
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var StakingWithLockup = artifacts.require('./StakingMilestones/StakingWithLockup.sol');
var Vault = artifacts.require('./StakingMilestones/Vault.sol');
var mySlice = artifacts.require('./test/MySlice.sol');
var myDai = artifacts.require('./test/MyERC20.sol');

const totalReward = "1000000";

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
      [1000, 2000, 3000, 4000, 5000],
        [
          web3.utils.toWei((1).toString(), "ether"),
          web3.utils.toWei((2).toString(), "ether"),
          web3.utils.toWei((3).toString(), "ether"),
          web3.utils.toWei((4).toString(), "ether"),
          web3.utils.toWei((5).toString(), "ether")
        ],
        [10, 20, 30, 40, 50],
        "Stake Token",
        "STK",
    ], { from: tokenOwner });

    console.log('STAKING_LOCKUP_CONTRACT=' + stakingLockupInstance.address);

    await vaultInstance.setAllowance(stakingLockupInstance.address, web3.utils.toWei(totalReward), { from: tokenOwner });

    await mySliceInstance.transfer(vaultInstance.address, web3.utils.toWei(totalReward), { from: tokenOwner });

  } else if (network == 'kovan') {
    let { SLICEAddress, VAULT_ADDRESS, } = process.env;
    let SLICE = new web3.eth.Contract(abi, SLICEAddress)
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;

    console.log('control in deploying staking lockup', SLICEAddress, VAULT_ADDRESS);
    let VaultInstance = await deployer.deploy(Vault, SLICEAddress, { from: tokenOwner });
    console.log('VAULT=' + VaultInstance.address)

    let stakingLockupInstance = await deployProxy(StakingWithLockup, [
      VaultInstance.address,
      SLICEAddress,
      SLICEAddress,
      [1000, 2000, 3000], // 10%, 20%, 30%
      [toWei('200000'), toWei('300000'), toWei('500000')],
      ["15768000", "31536000", "63072000"], // 6 month, 1 year, 2 year
      "SLICE STAKE",
      "SLICE_STAKE"
    ], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('STAKING_LOCKUP_CONTRACT=' + stakingLockupInstance.address);

    await VaultInstance.setAllowance(stakingLockupInstance.address, toWei(totalReward), { from: tokenOwner });

    await SLICE.methods.transfer(Vault.address, toWei(totalReward)).send({ from: tokenOwner });
  }

};
