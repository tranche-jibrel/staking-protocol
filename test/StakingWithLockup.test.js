const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time,
  constants
} = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;

const timeMachine = require('ganache-time-traveler');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var stakingWithLockup = artifacts.require('./StakingWithLockup.sol');
var Vault = artifacts.require('./Vault.sol');
var mySlice = artifacts.require('./test/MySlice.sol');
var myDai = artifacts.require('./test/MyERC20.sol');


let sliceContract, daiContract, vaultContract, stkLckpContract;
let owner, user1, user2, user3, user4;

contract("StakingWithLockup", function (accounts) {

  it("ETH balances", async function () {
    //accounts = await web3.eth.getAccounts();
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];
    // console.log(owner);
    // console.log(await web3.eth.getBalance(owner));
    // console.log(await web3.eth.getBalance(user1));
  });

  describe("setups", function () {
    it("retrieve deployed contracts", async function () {
      sliceContract = await mySlice.deployed();
      expect(sliceContract.address).to.be.not.equal(ZERO_ADDRESS);
      expect(sliceContract.address).to.match(/0x[0-9a-fA-F]{40}/);
      // console.log(protocolContract.address);
      daiContract = await myDai.deployed();
      expect(daiContract.address).to.be.not.equal(ZERO_ADDRESS);
      expect(daiContract.address).to.match(/0x[0-9a-fA-F]{40}/);

      vaultContract = await Vault.deployed();
      expect(vaultContract.address).to.be.not.equal(ZERO_ADDRESS);
      expect(vaultContract.address).to.match(/0x[0-9a-fA-F]{40}/);

      stkLckpContract = await stakingWithLockup.deployed();
      expect(stkLckpContract.address).to.be.not.equal(ZERO_ADDRESS);
      expect(stkLckpContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    });

    it("Should initialize", async function () {
      const vault = await stkLckpContract._vault();
      expect(vault).to.be.equal(vaultContract.address);

      const slice = await stkLckpContract._slice();
      expect(slice).to.be.equal(sliceContract.address);

      const stakeToken = await stkLckpContract._stakableToken();
      expect(stakeToken).to.be.equal(daiContract.address);

      const name = await stkLckpContract.name();
      expect(name).to.be.equal("Stake Token");

      const symbol = await stkLckpContract.symbol();
      expect(symbol).to.be.equal("STK");

      const numDurations = await stkLckpContract.numDurations();
      expect(numDurations).to.be.bignumber.equal(new BN("5"));

      const duration = await stkLckpContract.durations(0);
      expect(duration).to.be.bignumber.equal(new BN("10")); // 7 days = 7*24*60*60 seconds = 604800
    });
  });

  
  describe("deploy and initialize() other contracts", function () {
    it("Should not initialize if array lengths are not equal", async function () {

      this.stakingRewards1 = await stakingWithLockup.new({
        from: owner
      });

      await expectRevert(
        this.stakingRewards1.initialize(
          vaultContract.address,
          sliceContract.address,
          sliceContract.address,
          [100, 200, 300, 400, 500],
          [1000, 2000, 3000, 4000, 5000],
          [10, 20, 30, 40, 50, 60],
          "Stake Token",
          "STK",
          {
            from: owner
          }),
        "StakingWithLockup: Array lengths should be equal"
      );

      await expectRevert(
        this.stakingRewards1.initialize(
          vaultContract.address,
          sliceContract.address,
          sliceContract.address,
          [100, 200, 300, 400, 500, 600],
          [1000, 2000, 3000, 4000, 5000],
          [10, 20, 30, 40, 50],
          "Stake Token",
          "STK",
          {
            from: owner
          }),
        "StakingWithLockup: Array lengths should be equal"
      );
    });

  });

  describe("stake()", function () {
    beforeEach(async function () {
      await daiContract.transfer(user1, web3.utils.toWei("100"), { from: owner });
      await daiContract.transfer(user2, web3.utils.toWei("100"), { from: owner });
      await daiContract.transfer(user3, web3.utils.toWei("100"), { from: owner });
    });

    it("Should stake for user1", async function () {
     await daiContract.approve(stkLckpContract.address, web3.utils.toWei("1"), { from: user1 });

     await stkLckpContract.stake(web3.utils.toWei("1"), 0, { from: user1 });

     const balance = await daiContract.balanceOf(stkLckpContract.address);
     expect(balance).to.be.bignumber.equal(web3.utils.toWei("1"));

     const stakeTokenBalance = await stkLckpContract.balanceOf(user1);
     expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("1.1")); // Stake Token minted = amount staked + reward calculated

     var result = await stkLckpContract.stakingDetails(user1, 1);

     expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("1"));
     expect(result.reward).to.be.bignumber.equal(web3.utils.toWei("0.1"));
    });

    it("Should stake for user2", async function () {
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("10"), { from: user2 });

      await stkLckpContract.stake(web3.utils.toWei("10"), 1, { from: user2 });

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("11"));

      const stakeTokenBalance = await stkLckpContract.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("12")); // Stake Token minted = amount staked + reward calculated

      var result = await stkLckpContract.stakingDetails(user2, 1);

      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));
      expect(result.reward).to.be.bignumber.equal(web3.utils.toWei("2"));
    });

    it("Should stake lesser amount if exceeding reward cap", async function () {
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("15"), { from: user2 });

      await stkLckpContract.stake(web3.utils.toWei("15"), 2, { from: user2 });

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("21"));

      const stakeTokenBalance = await stkLckpContract.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("25")); // Stake Token minted = amount staked + reward calculated

      var result = await stkLckpContract.stakingDetails(user2, 2);

      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));
      expect(result.reward).to.be.bignumber.equal(web3.utils.toWei("3"));
    });

    it("Should not stake if amount entered is 0", async function () {
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("10"), { from: user3 });

      await expectRevert(
        stkLckpContract.stake(
          0,
          1,
          {
            from: user3
          }),
        "StakingWithLockup: Cannot stake 0 tokens"
      );
    });

    it("Should not stake if duration index entered is greater than or equal to numDurations", async function () {
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("10"), { from: user2 });

      await expectRevert(
        stkLckpContract.stake(
          10,
          5,
          {
            from: user2
          }),
        "StakingWithLockup: Please enter valid staking duration index"
      );
    });

    it("Should not stake if reward cap has been met (rewards allocated for that duration have been distributed)", async function () {
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("10"), { from: user2 });

      await expectRevert(stkLckpContract.stake(web3.utils.toWei("10"), 1, { from: user2 }), 
        "StakingWithLockup: Rewards allocated for this duration have been distributed");

    });

  });

  describe("claim() and massClaim()", function () {

    beforeEach(async function () {

      await stkLckpContract.setRewardDetails(
        [web3.utils.toWei("0.1"), web3.utils.toWei("0.2"), web3.utils.toWei("0.3"), web3.utils.toWei("0.4"), web3.utils.toWei("0.5")],
        [
          web3.utils.toWei("10"),
          web3.utils.toWei("20"),
          web3.utils.toWei("30"),
          web3.utils.toWei("40"),
          web3.utils.toWei("50")
        ],
        [20, 40, 60, 80, 100],
        {
          from: owner
        }
      );

      await daiContract.transfer(user1, web3.utils.toWei("100"), { from: owner });
      await daiContract.transfer(user2, web3.utils.toWei("100"), { from: owner });
      await daiContract.transfer(user3, web3.utils.toWei("100"), { from: owner });

      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("100"), { from: user1 });
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("100"), { from: user2 });
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("100"), { from: user3 });
    });

    it("Should claim for user1", async function () {
      const maturity = Number(time.duration.seconds(20));
      
      await stkLckpContract.stake(web3.utils.toWei("1"), 0, { from: user1 });

      // let block = await web3.eth.getBlockNumber();
      // console.log("Actual Block: " + block + ", time: " + (await web3.eth.getBlock(block)).timestamp);
      // for (i = 0; i <= 20; i++) {
      //     await timeMachine.advanceTimeAndBlock(1)
      // }
      await timeMachine.advanceTimeAndBlock(maturity);
      // block = await web3.eth.getBlockNumber()
      // console.log("New Actual Block: " + block + ", new time: " + (await web3.eth.getBlock(block)).timestamp)
      
      var stakeTokenBalance = await stkLckpContract.balanceOf(user1);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("2.2"));

      // res = await stkLckpContract.stakingDetails(user1, 1)
      // console.log(res[0].toString(), res[1].toString(), res[2].toString(), res[3].toString(), res[4].toString())
      // console.log((await stkLckpContract.stakeCounter(user1)).toString())

      await stkLckpContract.claim(1, { from: user1 });

      stakeTokenBalance = await stkLckpContract.balanceOf(user1);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("1.1"));

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("21"));

      const reward = await sliceContract.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei("0.1"));

      var result = await stkLckpContract.stakingDetails(user1, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should claim for user2", async function () {
      const maturity = Number(time.duration.seconds(40));
      
      await stkLckpContract.stake(web3.utils.toWei("10"), 1, { from: user2 });
      
      await timeMachine.advanceTimeAndBlock(maturity);

      var stakeTokenBalance = await stkLckpContract.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("37"));

      await stkLckpContract.claim(1, { from: user2 });

      stakeTokenBalance = await stkLckpContract.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("25"));

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("21"));

      const reward = await sliceContract.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei("2"));

      var result = await stkLckpContract.stakingDetails(user2, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should not claim if staking duration has not ended", async function () {
      const early = Number(time.duration.seconds(40));
      
      await stkLckpContract.stake(web3.utils.toWei("5"), 2, { from: user3 });
      
      await timeMachine.advanceTimeAndBlock(early);

      await expectRevert(
        stkLckpContract.claim(1, { from: user3 }),
        "StakingWithLockup: Cannot claim reward before endTime"
      );

      var stakeTokenBalance = await stkLckpContract.balanceOf(user3);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("6.5"));
      
      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("26"));

      const reward = await sliceContract.balanceOf(user3);
      expect(reward).to.be.bignumber.equal(new BN("0"));

      var result = await stkLckpContract.stakingDetails(user3, 1);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("5"));
      expect(result.reward).to.be.bignumber.equal(web3.utils.toWei("1.5"));
    });

    it("Should not be able to claim twice", async function () {
      const early = Number(time.duration.seconds(61));
      
      await stkLckpContract.stake(web3.utils.toWei("5"), 2, { from: user3 });
      
      await timeMachine.advanceTimeAndBlock(early);

      var stakeTokenBalance = await stkLckpContract.balanceOf(user3);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("13"));

      await stkLckpContract.claim(1, { from: user3 });

      stakeTokenBalance = await stkLckpContract.balanceOf(user3);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("6.5"));

      await expectRevert(
        stkLckpContract.claim(1, { from: user3 }),
        "StakingWithLockup: Stake does not exist"
      );
      
      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("26"));

      const reward = await sliceContract.balanceOf(user3);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei("1.5"));

      var result = await stkLckpContract.stakingDetails(user3, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should mass claim for user2", async function () {
      const maturity = Number(time.duration.seconds(61));
      
      await stkLckpContract.stake(web3.utils.toWei("10"), 0, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("10"), 1, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("10"), 2, { from: user2 });
      
      await timeMachine.advanceTimeAndBlock(maturity);
      // console.log((await stkLckpContract.stakeCounter(user2)).toString())
      await stkLckpContract.massClaim([4, 5, 6], { from: user2 });

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("26"));

      const reward = await sliceContract.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei("8"));

      var result = await stkLckpContract.stakingDetails(user2, 4);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));

      result = await stkLckpContract.stakingDetails(user2, 5);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));

      result = await stkLckpContract.stakingDetails(user2, 6);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should not mass claim if any one of the stakes does not exist(already been claimed or never staked)", async function () {
      const maturity = Number(time.duration.seconds(61));
      
      await stkLckpContract.stake(web3.utils.toWei("10"), 0, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("10"), 1, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("10"), 2, { from: user2 });
      
      await timeMachine.advanceTimeAndBlock(maturity);

      await stkLckpContract.claim(7, { from: user2 });

      await expectRevert(
        stkLckpContract.massClaim([7, 8, 9], { from: user2 }),
        "StakingWithLockup: Stake does not exist"
      );

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("46"));

      const reward = await sliceContract.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei("9"));

      var result = await stkLckpContract.stakingDetails(user2, 7);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));

      result = await stkLckpContract.stakingDetails(user2, 8);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));

      result = await stkLckpContract.stakingDetails(user2, 9);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));
    });

    it("Should not mass claim for user2 if maturity period is not over for at least one stake", async function () {
      const maturity = Number(time.duration.seconds(51));
      
      await stkLckpContract.stake(web3.utils.toWei("10"), 0, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("10"), 1, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("10"), 2, { from: user2 });
      // console.log((await stkLckpContract.stakeCounter(user2)).toString())
      await timeMachine.advanceTimeAndBlock(maturity);

      await expectRevert(
        stkLckpContract.massClaim([10, 11, 12], { from: user2 }),
        "StakingWithLockup: Cannot claim reward before endTime"
      );

      var stakeTokenBalance = await stkLckpContract.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei("86"));

      const balance = await daiContract.balanceOf(stkLckpContract.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei("76"));

      const reward = await sliceContract.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei("9"));

      var result = await stkLckpContract.stakingDetails(user2, 8);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));

      result = await stkLckpContract.stakingDetails(user2, 9);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));

      result = await stkLckpContract.stakingDetails(user2, 10);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei("10"));
    });

  });

  describe("repeal()", function () {
    beforeEach(async function () {
      await daiContract.transfer(user1, web3.utils.toWei("100"), { from: owner });
      await daiContract.transfer(user2, web3.utils.toWei("100"), { from: owner });
      await daiContract.transfer(user3, web3.utils.toWei("100"), { from: owner });

      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("100"), { from: user1 });
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("100"), { from: user2 });
      await daiContract.approve(stkLckpContract.address, web3.utils.toWei("100"), { from: user3 });
    });

    it("Should repeal", async function () {
     const balanceBefore = await daiContract.balanceOf(stkLckpContract.address);
     
     await stkLckpContract.stake(web3.utils.toWei("1"), 4, { from: user1 });
     await stkLckpContract.stake(web3.utils.toWei("1"), 4, { from: user2 });

     var balance = await daiContract.balanceOf(stkLckpContract.address);
     expect((balance - balanceBefore).toString()).to.be.bignumber.equal(web3.utils.toWei("2"));

     await stkLckpContract.repeal(4, { from: owner });

     balance = await daiContract.balanceOf(stkLckpContract.address);
     expect(balance).to.be.bignumber.equal(balanceBefore.toString());

     var result = await stkLckpContract.isRepealed(4);

     expect(result).to.equal(true);
    });

    it("Should not mass claim for user2 if duration is repealed", async function () {
      await stkLckpContract.stake(web3.utils.toWei("1"), 2, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("1"), 3, { from: user2 });
      await stkLckpContract.stake(web3.utils.toWei("1"), 2, { from: user2 });

      await stkLckpContract.repeal(3, { from: owner });

      await expectRevert(
        stkLckpContract.massClaim([15, 14, 16], { from: user2 }),
        "StakingWithLockup: This duration has been repealed!"
      );

      var result = await stkLckpContract.isRepealed(3);

      expect(result).to.equal(true);
    });

    it("Should not claim for user2 if duration is repealed", async function () {
      await stkLckpContract.stake(web3.utils.toWei("1"), 2, { from: user2 });

      await stkLckpContract.repeal(2, { from: owner });

      await expectRevert(
        stkLckpContract.claim(17, { from: user2 }),
        "StakingWithLockup: This duration has been repealed!"
      );

      var result = await stkLckpContract.isRepealed(2);

      expect(result).to.equal(true);
    });

    it("Should not repeal if duration index is invalid", async function () {
      await stkLckpContract.stake(web3.utils.toWei("1"), 4, { from: user1 });
      await stkLckpContract.stake(web3.utils.toWei("1"), 4, { from: user2 }); 

      await expectRevert(
        stkLckpContract.repeal(5, { from: owner }),
        "StakingWithLockup: Invalid duration index"
      );
    });

    it("Should not repeal if not called by the owner", async function () {
      await stkLckpContract.stake(web3.utils.toWei("1"), 4, { from: user1 });
      await stkLckpContract.stake(web3.utils.toWei("1"), 4, { from: user2 }); 

      await expectRevert(
        stkLckpContract.repeal(4, { from: user1 }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("setRewardDetails()", function () {
    it("Should set details", async function () {
      await stkLckpContract.setRewardDetails(
        [100, 200, 300, 400, 500],
        [
          web3.utils.toWei("5"),
          web3.utils.toWei("4"),
          web3.utils.toWei("3"),
          web3.utils.toWei("2"),
          web3.utils.toWei("1")
        ],
        [10, 20, 30, 40, 50],
        {
          from: owner
        }
      );

      // 1st duration
      var duration = await stkLckpContract.durations(0);
      expect(duration).to.be.bignumber.equal(new BN("10"));

      var reward = await stkLckpContract.percentageRewards(0);
      expect(reward).to.be.bignumber.equal(new BN("100"));

      var rewardCap = await stkLckpContract.rewardCapForDuration(0);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((5).toString(), "ether"));

      // 2nd duration
      duration = await stkLckpContract.durations(1);
      expect(duration).to.be.bignumber.equal(new BN("20"));

      reward = await stkLckpContract.percentageRewards(1);
      expect(reward).to.be.bignumber.equal(new BN("200"));

      rewardCap = await stkLckpContract.rewardCapForDuration(1);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((4).toString(), "ether"));

      // 3rd duration
      duration = await stkLckpContract.durations(2);
      expect(duration).to.be.bignumber.equal(new BN("30"));

      reward = await stkLckpContract.percentageRewards(2);
      expect(reward).to.be.bignumber.equal(new BN("300"));

      rewardCap = await stkLckpContract.rewardCapForDuration(2);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((3).toString(), "ether"));

      // 4th duration
      duration = await stkLckpContract.durations(3);
      expect(duration).to.be.bignumber.equal(new BN("40"));

      reward = await stkLckpContract.percentageRewards(3);
      expect(reward).to.be.bignumber.equal(new BN("400"));

      rewardCap = await stkLckpContract.rewardCapForDuration(3);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((2).toString(), "ether"));

      // 5th duration
      duration = await stkLckpContract.durations(4);
      expect(duration).to.be.bignumber.equal(new BN("50"));

      reward = await stkLckpContract.percentageRewards(4);
      expect(reward).to.be.bignumber.equal(new BN("500"));

      rewardCap = await stkLckpContract.rewardCapForDuration(4);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));
    });

    it("Should not set durations if array length is not 5", async function () {
      await expectRevert(
        stkLckpContract.setRewardDetails(
          [100, 200, 300, 400, 500],
          [
            web3.utils.toWei("5"),
            web3.utils.toWei("4"),
            web3.utils.toWei("3"),
            web3.utils.toWei("2"),
            web3.utils.toWei("1")
          ],
          [10, 20, 30, 40, 50, 60],
          { 
            from: owner
          }),
        "StakingWithLockup: Array lengths should be equal"
      );

      await expectRevert(
        stkLckpContract.setRewardDetails(
          [100, 200, 300, 400, 500, 600],
          [
            web3.utils.toWei("5"),
            web3.utils.toWei("4"),
            web3.utils.toWei("3"),
            web3.utils.toWei("2"),
            web3.utils.toWei("1")
          ],
          [10, 20, 30, 40, 50],
          { 
            from: owner
          }),
        "StakingWithLockup: Array lengths should be equal"
      );
    });

    it("Should not set durations if not called by owner", async function () {
      await expectRevert(
        stkLckpContract.setRewardDetails(
          [100, 200, 300, 400, 500],
          [
            web3.utils.toWei("5"),
            web3.utils.toWei("4"),
            web3.utils.toWei("3"),
            web3.utils.toWei("2"),
            web3.utils.toWei("1")
          ],
          [10, 20, 30, 40, 50],
          { 
            from: user4
          }),
        "Ownable: caller is not the owner"
      );
    });
  });


});