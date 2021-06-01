require('dotenv').config();
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
var StakingWithLockup = artifacts.require('./StakingMilestones/StakingWithLockup.sol');
var Vault = artifacts.require('./StakingMilestones/Vault.sol');
var { abi } = require('../build/contracts/IERC20.json');

module.exports = async (deployer, network, accounts) => {
  if (network == 'kovan') {
    let { SLICEAddress, VAULT_ADDRESS, } = process.env;
    let SLICE = new web3.eth.Contract(abi, SLICEAddress)
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;
    const totalReward = "1000000";

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
