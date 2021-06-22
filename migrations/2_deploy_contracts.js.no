// require('dotenv').config();
// const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
// var Vault = artifacts.require('./StakingMilestones/Vault.sol');
// var StakingMilestones = artifacts.require('./StakingMilestones/StakingMilestones.sol');
// var YieldFarm = artifacts.require('./StakingMilestones/YieldFarm.sol');
// var ERC20 = artifacts.require('./test/myERC20.sol');
// var { abi } = require('../build/contracts/IERC20.json');

// module.exports = async (deployer, network, accounts) => {
//   if (network == 'development') {
//     // let { SLICEAddress, LP1Address, LP2Address } = process.env;
//     const accounts = await web3.eth.getAccounts();
//     const tokenOwner = accounts[0];
//     const toWei = web3.utils.toWei;

//     let SLICEInstance = await deployer.deploy(ERC20, { from: tokenOwner });
//     let LPInstance = await deployer.deploy(ERC20, { from: tokenOwner });
//     SLICEInstance.initialize(1000000000, "Tranche Network", "SLICE", { from: tokenOwner })
//     LPInstance.initialize(1000000000, "LP Token", "SLICE", { from: tokenOwner })
//     await deployer.deploy(Vault, SLICEInstance.address, { from: tokenOwner });
//     // set Allowance
//     let StakingInstance = await deployProxy(StakingMilestones, [Date.now(), 3600], { from: tokenOwner, unsafeAllowCustomTypes: true });
//     let YieldFarmInstance = await deployProxy(YieldFarm, [SLICEInstance.address, StakingInstance.address, Vault.address, toWei('1000')], { from: tokenOwner, unsafeAllowCustomTypes: true });

//     await YieldFarmInstance.addStakableToken(SLICEInstance.address, 200, { from: tokenOwner });
//     await YieldFarmInstance.addStakableToken(LP1Address, 100, { from: tokenOwner });
//     console.log('VAULT_ADDRESS=' + Vault.address);
//     console.log('STAKING_ADDRESS=' + StakingInstance.address);
//     console.log('STAKING_YIELD_ADDRESS=' + YieldFarmInstance.address);
//     console.log('REACT_APP_STAKING_ADDRESS=' + StakingInstance.address);

//   } else if (network == 'kovan') {
//     let { SLICEAddress, LP1Address, LP2Address, EPOCH_START_TIME, EPOCH_DURATION, EPOCH_REWARD, IS_UPGRADE, 
//       IS_STAKING_UPGRADE, IS_YIELD_UPGRADE, STAKING_SLICE, STAKING_LP1, STAKING_LP2, YIELD_SLICE, YIELD_LP1, YIELD_LP2 } = process.env;
//     const accounts = await web3.eth.getAccounts();
//     const tokenOwner = accounts[0];

//     if (IS_UPGRADE === 'true') {
//       console.log('Contracts are upgrading, process started: ')
//       console.log(`STAKING_SLICE=${STAKING_SLICE}`)
//       console.log(`STAKING_LP1=${STAKING_LP1}`)
//       console.log(`STAKING_LP2=${STAKING_LP2}`)
//       console.log(`YIELD_SLICE=${YIELD_SLICE}`)
//       console.log(`YIELD_LP1=${YIELD_LP1}`)
//       console.log(`YIELD_LP2=${YIELD_LP2}`)

//       if (IS_STAKING_UPGRADE == 'true') {
//         await upgradeProxy(STAKING_SLICE, StakingMilestones, { from: tokenOwner });
//         await upgradeProxy(STAKING_LP1, StakingMilestones, { from: tokenOwner });
//         await upgradeProxy(STAKING_LP2, StakingMilestones, { from: tokenOwner });
//         console.log('Staking contracts upgrade completed.')
//       }
//       if (IS_YIELD_UPGRADE == 'true') {
//         await upgradeProxy(YIELD_SLICE, YieldFarm, { from: tokenOwner });
//         await upgradeProxy(YIELD_LP1, YieldFarm, { from: tokenOwner });
//         await upgradeProxy(YIELD_LP2, YieldFarm, { from: tokenOwner });
//         console.log('YieldFarm contracts upgrade completed.')
//       }
//       console.log('Contracts are upgraded')
//     } else {
//       let SLICE = new web3.eth.Contract(abi, SLICEAddress)
//       const toWei = web3.utils.toWei;
//       // const currentTime = (Date.now() - Date.now() % 1000) / 1000;
  
//       let VaultInstance = await deployer.deploy(Vault, SLICEAddress, { from: tokenOwner });
  
//       // slice deployment
//       let StakingInstanceSlice = await deployProxy(StakingMilestones, [EPOCH_START_TIME, EPOCH_DURATION], { from: tokenOwner, unsafeAllowCustomTypes: true });
//       let YieldFarmInstanceSlice = await deployProxy(YieldFarm, [SLICEAddress, StakingInstanceSlice.address, SLICEAddress, Vault.address, toWei('100')], { from: tokenOwner, unsafeAllowCustomTypes: true });
//       await SLICE.methods.transfer(Vault.address, toWei(EPOCH_REWARD)).send({ from: tokenOwner });
//       await VaultInstance.setAllowance(YieldFarmInstanceSlice.address, toWei(EPOCH_REWARD), { from: tokenOwner });
//       await StakingInstanceSlice.manualEpochInit([SLICEAddress], 0, { from: tokenOwner });
//       await StakingInstanceSlice.manualEpochInit([SLICEAddress], 1, { from: tokenOwner });
  
//       // // LP1 deployment
//       let StakingInstanceLp1 = await deployProxy(StakingMilestones, [EPOCH_START_TIME, EPOCH_DURATION], { from: tokenOwner, unsafeAllowCustomTypes: true });
//       let YieldFarmInstanceLp1 = await deployProxy(YieldFarm, [SLICEAddress, StakingInstanceLp1.address, LP1Address, Vault.address, toWei('200')], { from: tokenOwner, unsafeAllowCustomTypes: true });
//       await SLICE.methods.transfer(Vault.address, toWei(EPOCH_REWARD)).send({ from: tokenOwner });
//       await VaultInstance.setAllowance(YieldFarmInstanceLp1.address, toWei(EPOCH_REWARD), { from: tokenOwner });
//       await StakingInstanceLp1.manualEpochInit([LP1Address], 0, { from: tokenOwner });
//       await StakingInstanceLp1.manualEpochInit([LP1Address], 1, { from: tokenOwner });
  
//       //Lp2 deployment
//       let StakingInstanceLp2 = await deployProxy(StakingMilestones, [EPOCH_START_TIME, EPOCH_DURATION], { from: tokenOwner, unsafeAllowCustomTypes: true });
//       let YieldFarmInstanceLp2 = await deployProxy(YieldFarm, [SLICEAddress, StakingInstanceLp2.address, LP2Address, Vault.address, toWei('300')], { from: tokenOwner, unsafeAllowCustomTypes: true });
//       await SLICE.methods.transfer(Vault.address, toWei(EPOCH_REWARD)).send({ from: tokenOwner });
//       await VaultInstance.setAllowance(YieldFarmInstanceLp2.address, toWei(EPOCH_REWARD), { from: tokenOwner });
//       await StakingInstanceLp2.manualEpochInit([LP2Address], 0, { from: tokenOwner });
//       await StakingInstanceLp2.manualEpochInit([LP2Address], 1, { from: tokenOwner });
  
//       console.log('VAULT_ADDRESS=' + Vault.address);
//       console.log('STAKING_ADDRESS=' + [StakingInstanceSlice.address, StakingInstanceLp1.address, StakingInstanceLp2.address].join(','));
//       console.log('STAKING_YIELD_ADDRESS=' + [YieldFarmInstanceSlice.address, YieldFarmInstanceLp1.address, YieldFarmInstanceLp2.address].join(','));
  
//       console.log('STAKING_SLICE=' + StakingInstanceSlice.address)
//       console.log('STAKING_LP1=' + StakingInstanceLp1.address)
//       console.log('STAKING_LP2=' + StakingInstanceLp2.address)
  
//       console.log('YIELD_SLICE=' + YieldFarmInstanceSlice.address)
//       console.log('YIELD_LP1=' + YieldFarmInstanceLp1.address)
//       console.log('YIELD_LP2=' + YieldFarmInstanceLp2.address)
  
//       console.log('REACT_APP_STAKING_ADDRESS=' + [StakingInstanceSlice.address, StakingInstanceLp1.address, StakingInstanceLp2.address].join(','));
//       console.log('REACT_APP_STAKING_YIELD_ADDRESS=' + [YieldFarmInstanceSlice.address, YieldFarmInstanceLp1.address, YieldFarmInstanceLp2.address].join(','));
//     }
//   }

// };
