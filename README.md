<!-- Add banner here -->

# Staking Protocol

<img src="https://gblobscdn.gitbook.com/spaces%2F-MP969WsfbfQJJFgxp2K%2Favatar-1617981494187.png?alt=media" alt="Tranche Logo" width="100">

Staking is a decentralized protocol used to serve 2 functionalities: 
1. LP Staking - Liquidity Incentivization: To ensure constant liquidity in Uniswap Pools, LP staking incentivizing users to provide ETH, Dai and SLICE into Uniswap contracts. 
2. SLICE Staking - Backstop Module: In the event of protocol insolvency the staked SLICE acts as the protocols backstop module, preventing Tranche losses. 

Info URL: https://docs.tranche.finance/tranchefinance/tranche-app/staking

## Development

### Install Dependencies

```bash
npm i
```

### Compile project

```bash
truffle compile --all
```

### Run test

Start ganache:
```bash
npx ganache-cli --deterministic -l 12000000
```
Run tests:
```bash
truffle test
```
Or test a single file:
```bash
truffle test ./test/StakingWithLockup.test.js
```

### Code Coverage

```bash
truffle run coverage
```

or to test a single file:

```bash
truffle run coverage --network development --file="test/StakingWithLockup.test.js"    
```

## Tranche Staking Lockup Usage

Following is a description on how to use project on Kovan testnet.

a) Deploy SLICE token(MyERC20 contract)

b) Initialize SLICE token : (uint256 _initialSupply, string memory name, string memory symbol)

c) Deploy the Vault contract with constructor parameter : (address sliceAddress)

d) Deploy the StakingWithLockup contract

e) Initialize the StakingWithLockup contract : (address vault, address slice, address stakableToken, uint256[] calldata rewardsForDuration, uint256[] calldata rewardCapsForDuration, uint256[] calldata rewardDurations, string memory name, string memory symbol) - For variable details refer to the mainnet network in ./migrations/1_deploy_contracts.js

f) Call the setAllowance() function in the Vault contract with parameters : (address spender, uint amount) - spender is the StakingWithLockup contract and amount is the total amount we want to distribute as rewards

Users can now call stake() and claim() functions in the StakingWithLockup contract to stake SLICE and redeem rewards(SLICE)

[(Back to top)](#Staking-Protocol)

## Tranche Staking LP Usage

Following is a description on how to use project on Kovan testnet.

a) Deploy SLICE token(MyERC20 contract)

b) Initialize SLICE token : (uint256 _initialSupply, string memory name, string memory symbol)

c) Deploy LP token(MyERC20 contract)

d) Initialize LP token : (uint256 _initialSupply, string memory name, string memory symbol)

e) Deploy the Vault contract with constructor parameter : (address sliceAddress)

f) Deploy the StakingMilestones contract

g) Initialize the StakingMilestones contract : (uint256 _epoch1Start, uint256 _epochDuration) - _epoch1Start is the epoch time in seconds when we want the staking to start and _epochDuration is the duration of each epoch in seconds

h) Deploy the YieldFarmLP contract

i) Initialize the YieldFarmLP contract : (address sliceAddress, address stakeContract, address vault, uint _totalRewardInEpoch) - stakeContract is the address of the StakingMilestones contract deployed above and _totalRewardInEpoch is the total amount of SLICE we want to distribute as rewards

j) Call the addStakableToken() function in the YieldFarmLP contract with parameters : (address _tokenAddress, uint _weight) - _tokenAddress is the LP address and _weight is 100 in our case

k) Call the setAllowance() function in the Vault contract with parameters : (address spender, uint amount) - spender is the YieldFarmLP contract and amount is the total amount we want to distribute as rewards

Users can now call deposit() and massHarvest() functions in the StakingMilestones and YieldFarmLP contracts respectively to stake LP and redeem rewards(SLICE)

[(Back to top)](#Staking-Protocol)


## Main contracts - Name, Size and Description

<table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Size (KiB)</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
        <tr>
            <td>StakingMilestones</td>
            <td><code>11.25 KiB</code></td>
            <td>Used to store all the tokens(LP) staked by the users</td>
        </tr>
        <tr>
            <td>StakingWithLockup</td>
            <td><code>9.95 KiB</code></td>
            <td>Used to stake SLICE and contract where the SLICE rewards are calculated on the basis of staking lengths</td>
        </tr>
        <tr>
            <td>Vault</td>
            <td><code>2.70 KiB</code></td>
            <td>Contract from where all SLICE rewards are distributed</td>
        </tr>
        <tr>
            <td>YieldFarm</td>
            <td><code>6.12 KiB</code></td>
            <td>Contract where user SLICE rewards are calculated based on: a) number of tokens staked, and b) staking duration (single token)</td>
        </tr>
        <tr>
            <td>YieldFarmLP</td>
            <td><code>7.67 KiB</code></td>
            <td>Contract where user SLICE rewards are calculated based on: a) number of tokens staked, and b) staking duration (LP token)</td>
        </tr>
    </tbody>
  </table>

  [(Back to top)](#Staking-Protocol)