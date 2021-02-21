require('dotenv').config();
var Staking = artifacts.require('./Staking.sol');

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
    const tokenOwner = accounts[0];
    await deployer.deploy(Staking, 21022021, 1337, SLICEAddress, { from: tokenOwner });
    console.log('STAKING_ADDRESS=' + Staking.address);
    console.log('REACT_APP_STAKING_ADDRESS=' + Staking.address);
  }
};
