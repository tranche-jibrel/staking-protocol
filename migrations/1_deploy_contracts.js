require('dotenv').config();
var Staking = artifacts.require('./Staking.sol');
var { abi } = require('../build/contracts/IERC20.json');

module.exports = async (deployer, network, accounts) => {
  // const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  if (network == 'development') {
    let { SLICEAddress } = process.env;
    const tokenOwner = accounts[0];
    await deployer
      .deploy(Staking, 21022021, 1337, SLICEAddress, { from: tokenOwner })
      .then(console.log('Staking Contract Deployed: ', Staking.address));
      
  } else if (network == 'kovan') {
    let { SLICEAddress } = process.env;
    let SLICE = new web3.eth.Contract(abi, SLICEAddress)
    const accounts = await web3.eth.getAccounts();
    const tokenOwner = accounts[0];
    const toWei = web3.utils.toWei;
    
    let SCInstance = await deployer.deploy(Staking, 21022021, toWei('1'), SLICEAddress, { from: tokenOwner });
    SCInstance = await Staking.deployed();
    await SCInstance.addStakableToken(SLICEAddress, toWei('1'), { from: tokenOwner })
    await SLICE.methods.transfer(Staking.address, toWei('1000')).send({ from: tokenOwner });
    console.log('STAKING_ADDRESS=' + Staking.address);
    console.log('REACT_APP_STAKING_ADDRESS=' + Staking.address);
  }
};
