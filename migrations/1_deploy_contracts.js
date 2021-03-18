require('dotenv').config();
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
var Vault = artifacts.require('./StakingMilestones/Vault.sol');
var StakingMilestones = artifacts.require('./StakingMilestones/StakingMilestones.sol');
var YieldFarm = artifacts.require('./StakingMilestones/YieldFarm.sol');

module.exports = async (deployer, network, accounts) => {

  if (network == 'kovan') {
    let { SLICEAddress, LP1Address, LP2Address, EPOCH_DURATION, EPOCH_REWARD, EPOCH_START_TIME } = process.env;
    EPOCH_START_TIME = +EPOCH_START_TIME;
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;

    let VaultInstance = await deployer.deploy(Vault, SLICEAddress, { from: tokenOwner });
    console.log('VAULT_ADDRESS=' + Vault.address);

    // slice deployment
    let StakingInstanceSlice = await deployProxy(StakingMilestones, [EPOCH_START_TIME, EPOCH_DURATION], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('staking instance deployed 1' + StakingInstanceSlice.address)
    let YieldFarmInstanceSlice = await deployProxy(YieldFarm, [SLICEAddress, StakingInstanceSlice.address, SLICEAddress, Vault.address, toWei(EPOCH_REWARD)], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('staking yield deployed 1' + YieldFarmInstanceSlice.address)
    await VaultInstance.setAllowance(YieldFarmInstanceSlice.address, toWei('2000000'), { from: tokenOwner });
    console.log('allowance set 1');
    await StakingInstanceSlice.manualEpochInit([SLICEAddress], 0, { from: tokenOwner });
    console.log('epoch init 1');

    // // LP1 deployment
    let StakingInstanceLp1 = await deployProxy(StakingMilestones, [EPOCH_START_TIME, EPOCH_DURATION], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('staking instance deployed 2' + StakingInstanceLp1.address)
    let YieldFarmInstanceLp1 = await deployProxy(YieldFarm, [SLICEAddress, StakingInstanceLp1.address, LP1Address, Vault.address, toWei(EPOCH_REWARD)], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('staking yield deployed 2' + YieldFarmInstanceLp1.address)
    await VaultInstance.setAllowance(YieldFarmInstanceLp1.address, toWei('2000000'), { from: tokenOwner });
    console.log('allowance set 2');
    await StakingInstanceLp1.manualEpochInit([LP1Address], 0, { from: tokenOwner });
    console.log('epoch init 2');

    //Lp2 deployment
    let StakingInstanceLp2 = await deployProxy(StakingMilestones, [EPOCH_START_TIME, EPOCH_DURATION], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('staking instance deployed 3' + StakingInstanceLp2.address)
    let YieldFarmInstanceLp2 = await deployProxy(YieldFarm, [SLICEAddress, StakingInstanceLp2.address, LP2Address, Vault.address, toWei(EPOCH_REWARD)], { from: tokenOwner, unsafeAllowCustomTypes: true });
    console.log('staking yield deployed 3' + YieldFarmInstanceLp2.address)
    await VaultInstance.setAllowance(YieldFarmInstanceLp2.address, toWei('2000000'), { from: tokenOwner });
    console.log('allowance set 1');
    await StakingInstanceLp2.manualEpochInit([LP2Address], 0, { from: tokenOwner });
    console.log('epoch init 3');


    console.log('STAKING_ADDRESS=' + [StakingInstanceSlice.address, StakingInstanceLp1.address, StakingInstanceLp2.address].join(','));
    console.log('STAKING_YIELD_ADDRESS=' + [YieldFarmInstanceSlice.address, YieldFarmInstanceLp1.address, YieldFarmInstanceLp2.address].join(','));

    console.log('STAKING_SLICE=' + StakingInstanceSlice.address)
    console.log('STAKING_LP1=' + StakingInstanceLp1.address)
    console.log('STAKING_LP2=' + StakingInstanceLp2.address)

    console.log('YIELD_SLICE=' + YieldFarmInstanceSlice.address)
    console.log('YIELD_LP1=' + YieldFarmInstanceLp1.address)
    console.log('YIELD_LP2=' + YieldFarmInstanceLp2.address)

    console.log('REACT_APP_STAKING_ADDRESS=' + [StakingInstanceSlice.address, StakingInstanceLp1.address, StakingInstanceLp2.address].join(','));
    console.log('REACT_APP_STAKING_YIELD_ADDRESS=' + [YieldFarmInstanceSlice.address, YieldFarmInstanceLp1.address, YieldFarmInstanceLp2.address].join(','));

  }

};
