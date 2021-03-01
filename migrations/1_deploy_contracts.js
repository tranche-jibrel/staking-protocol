require('dotenv').config();
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
var Staking = artifacts.require('./Staking.sol');
var { abi } = require('../build/contracts/IERC20.json');

module.exports = async (deployer, network, accounts) => {
  // const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  if (network == 'development') {
    // let { SLICEAddress } = process.env;
    // const tokenOwner = accounts[0];
    // await deployer
    //   .deploy(Staking, 21022021, 1337, SLICEAddress, { from: tokenOwner })
    //   .then(console.log('Staking Contract Deployed: ', Staking.address));
      
  } else if (network == 'kovan') {
    let { SLICEAddress, LP1Address, LP2Address } = process.env;
    let SLICE = new web3.eth.Contract(abi, SLICEAddress)
    let LP1 = new web3.eth.Contract(abi, LP1Address)
    let LP2 = new web3.eth.Contract(abi, LP2Address)
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;

    let SCInstance = await deployProxy(Staking, [1613982253, toWei('10000000000'), 25, SLICEAddress], { from: tokenOwner, unsafeAllowCustomTypes: true });
    // SCInstance = await Staking.deployed();
    await SCInstance.addStakableToken(SLICEAddress, 1000000000, { from: tokenOwner })
    await SCInstance.addStakableToken(LP1Address, 1000000000, { from: tokenOwner })
    await SCInstance.addStakableToken(LP2Address, 1000000000, { from: tokenOwner })
    await SLICE.methods.transfer(SCInstance.address, toWei('10000')).send({ from: tokenOwner });
    await LP1.methods.transfer(SCInstance.address, toWei('10000')).send({ from: tokenOwner });
    await LP2.methods.transfer(SCInstance.address, toWei('10000')).send({ from: tokenOwner });
    console.log('STAKING_ADDRESS=' + Staking.address);
    console.log('REACT_APP_STAKING_ADDRESS=' + Staking.address);
  }
};
