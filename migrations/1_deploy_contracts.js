require('dotenv').config();
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
var Vault = artifacts.require('./StakingMilestones/Vault.sol');
var StakingMilestones = artifacts.require('./StakingMilestones/StakingMilestones.sol');
var YieldFarm = artifacts.require('./StakingMilestones/YieldFarm.sol');
var { abi } = require('../build/contracts/IERC20.json');

module.exports = async (deployer, network, accounts) => {
  if (network == 'development') {
    let { SLICEAddress, LP1Address, LP2Address } = process.env;
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;

    await deployer.deploy(Vault, SLICEAddress, { from: tokenOwner });
    // set Allowance
    let StakingInstance = await deployProxy(StakingMilestones, [Date.now(), 3600], { from: tokenOwner, unsafeAllowCustomTypes: true });
    let YieldFarmInstance = await deployProxy(YieldFarm, [SLICEAddress, StakingInstance.address, Vault.address, toWei('1000')], { from: tokenOwner, unsafeAllowCustomTypes: true });
    
    await StakingInstance.setYieldFarmAddress(YieldFarmInstance.address, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(SLICEAddress, 200, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP1Address, 100, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP2Address, 100, { from: tokenOwner });
    console.log('VAULT_ADDRESS=' + Vault.address);
    console.log('STAKING_ADDRESS=' + StakingInstance.address);
    console.log('STAKING_YIELD_ADDRESS=' + YieldFarmInstance.address);    
    console.log('REACT_APP_STAKING_ADDRESS=' + StakingInstance.address);

  } else if (network == 'kovan') {
    let { SLICEAddress, LP1Address, LP2Address } = process.env;
    const accounts = await web3.eth.getAccounts();
    let SLICE = new web3.eth.Contract(abi, SLICEAddress)
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;

    let VaultInstance = await deployer.deploy(Vault, SLICEAddress, { from: tokenOwner });
    let StakingInstance = await deployProxy(StakingMilestones, [Date.now(), 3600], { from: tokenOwner, unsafeAllowCustomTypes: true });
    let YieldFarmInstance = await deployProxy(YieldFarm, [SLICEAddress, StakingInstance.address, Vault.address, toWei('1000')], { from: tokenOwner, unsafeAllowCustomTypes: true });

    await SLICE.methods.transfer(Vault.address, toWei('10000')).send({ from: tokenOwner });
    await VaultInstance.setAllowance(YieldFarmInstance.address, toWei('10000'), { from: tokenOwner });
    await StakingInstance.setYieldFarmAddress(YieldFarmInstance.address, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(SLICEAddress, 200, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP1Address, 100, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP2Address, 100, { from: tokenOwner });
    console.log('VAULT_ADDRESS=' + Vault.address);
    console.log('STAKING_ADDRESS=' + StakingInstance.address);
    console.log('STAKING_YIELD_ADDRESS=' + YieldFarmInstance.address);    
    console.log('REACT_APP_STAKING_ADDRESS=' + StakingInstance.address);
  }
};
