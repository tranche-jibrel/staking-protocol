require('dotenv').config();
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
var Vault = artifacts.require('./StakingMilestones/Vault.sol');
var StakingMilestones = artifacts.require('./StakingMilestones/StakingMilestones.sol');
var YieldFarm = artifacts.require('./StakingMilestones/YieldFarm.sol');
var ERC20 = artifacts.require('./test/myERC20.sol');
var { abi } = require('../build/contracts/IERC20.json');

module.exports = async (deployer, network, accounts) => {
  if (network == 'development') {
    // let { SLICEAddress, LP1Address, LP2Address } = process.env;
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;

    let SLICEInstance = await deployer.deploy(ERC20, { from: tokenOwner });
    let LPInstance = await deployer.deploy(ERC20, { from: tokenOwner });
    SLICEInstance.initialize(1000000000, "Tranche Network", "SLICE", { from: tokenOwner })
    LPInstance.initialize(1000000000, "LP Token", "SLICE", { from: tokenOwner })
    await deployer.deploy(Vault, SLICEInstance.address, { from: tokenOwner });
    // set Allowance
    let StakingInstance = await deployProxy(StakingMilestones, [Date.now(), 3600], { from: tokenOwner, unsafeAllowCustomTypes: true });
    let YieldFarmInstance = await deployProxy(YieldFarm, [SLICEInstance.address, StakingInstance.address, Vault.address, toWei('1000')], { from: tokenOwner, unsafeAllowCustomTypes: true });
    
    await YieldFarmInstance.addStakableToken(SLICEInstance.address, 200, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP1Address, 100, { from: tokenOwner });
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
    const currentTime = ( Date.now() - Date.now() % 1000 ) / 1000;

    let VaultInstance = await deployer.deploy(Vault, SLICEAddress, { from: tokenOwner });
    let StakingInstance = await deployProxy(StakingMilestones, [currentTime, 7200], { from: tokenOwner, unsafeAllowCustomTypes: true });
    let YieldFarmInstance = await deployProxy(YieldFarm, [SLICEAddress, StakingInstance.address, Vault.address, toWei('1000')], { from: tokenOwner, unsafeAllowCustomTypes: true });

    await SLICE.methods.transfer(Vault.address, toWei('10000')).send({ from: tokenOwner });
    await VaultInstance.setAllowance(YieldFarmInstance.address, toWei('10000'), { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(SLICEAddress, 200, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP1Address, 100, { from: tokenOwner });
    await YieldFarmInstance.addStakableToken(LP2Address, 100, { from: tokenOwner });
    await StakingInstance.manualEpochInit([SLICEAddress, LP1Address, LP2Address], 0, { from: tokenOwner });
    console.log('VAULT_ADDRESS=' + Vault.address);
    console.log('STAKING_ADDRESS=' + StakingInstance.address);
    console.log('STAKING_YIELD_ADDRESS=' + YieldFarmInstance.address);    
    console.log('REACT_APP_STAKING_ADDRESS=' + StakingInstance.address);
  }
};
