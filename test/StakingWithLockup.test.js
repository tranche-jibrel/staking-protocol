const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time,
  constants
} = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = constants;

const StakingRewards = contract.fromArtifact("StakingWithLockup");
const Vault = contract.fromArtifact("Vault");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("StakingWithLockup", function () {
  const [owner, anotherAccount, user1, user2, user3] = accounts;

  beforeEach(async function () {

    this.slice = await Token.new({
      from: owner
    });

    await this.slice.initialize(1000000000, "Jibrel Token", "SLICE", {
      from: owner
    });

    this.vault = await Vault.new(this.slice.address, { from: owner });

    await this.slice.transfer(
      this.vault.address,
      web3.utils.toWei((10000).toString(), "ether"),
      { from: owner }
    );

    this.dai = await Token.new({
      from: owner,
    });

    await this.dai.initialize(1000, "DAIToken", "DAI", {
      from: owner,
    });
  });

  describe("deploy and initialize()", function () {

    it("Should initialize", async function () {

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      await this.stakingRewards.initialize(
        this.vault.address,
        this.slice.address,
        this.dai.address,
        [100, 200, 300, 400, 500],
        [1000, 2000, 3000, 4000, 5000],
        [10, 20, 30, 40, 50],
        "Stake Token",
        "STK",
        {
          from: owner
        }
      );

      const vault = await this.stakingRewards._vault();
      expect(vault).to.be.equal(this.vault.address);

      const slice = await this.stakingRewards._slice();
      expect(slice).to.be.equal(this.slice.address);

      const stakeToken = await this.stakingRewards._stakableToken();
      expect(stakeToken).to.be.equal(this.dai.address);

      const name = await this.stakingRewards.name();
      expect(name).to.be.equal("Stake Token");

      const symbol = await this.stakingRewards.symbol();
      expect(symbol).to.be.equal("STK");

      const numDurations = await this.stakingRewards.numDurations();
      expect(numDurations).to.be.bignumber.equal(new BN("5"));

      const duration = await this.stakingRewards.durations(0);
      expect(duration).to.be.bignumber.equal(new BN("10")); // 7 days = 7*24*60*60 seconds = 604800
    });

    it("Should not initialize if array lengths are not equal", async function () {

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      await expectRevert(
        this.stakingRewards.initialize(
          this.vault.address,
          this.slice.address,
          this.slice.address,
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
        this.stakingRewards.initialize(
          this.vault.address,
          this.slice.address,
          this.slice.address,
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

    // it("Should not initialize if penalty is set to 100%", async function () {

    //     this.stakingRewards = await StakingRewards.new({
    //       from: owner
    //     });
  
    //     await expectRevert(
    //         this.stakingRewards.initialize(
    //             this.vault.address,
    //             this.slice.address,
    //             this.slice.address,
    //             [10, 20, 30, 40, 50],
    //             100000,
    //             {
    //               from: owner
    //             }
    //           ),
    //       "StakingWithLockup: Penalty should be less than 100%"
    //     );
    //   });

  });

  describe("stake()", function () {

    beforeEach(async function () {

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      await this.stakingRewards.initialize(
        this.vault.address,
        this.slice.address,
        this.dai.address,
        [1000, 2000, 3000, 4000, 5000],
        [
          web3.utils.toWei((1).toString(), "ether"),
          web3.utils.toWei((2).toString(), "ether"),
          web3.utils.toWei((3).toString(), "ether"),
          web3.utils.toWei((4).toString(), "ether"),
          web3.utils.toWei((5).toString(), "ether")
        ],
        [10, 20, 30, 40, 50],
        "Stake Token",
        "STK",
        {
          from: owner
        }
      );

      await this.dai.transfer(user1, web3.utils.toWei((100).toString(), "ether"), { from: owner });
      await this.dai.transfer(user2, web3.utils.toWei((100).toString(), "ether"), { from: owner });
      await this.dai.transfer(user3, web3.utils.toWei((100).toString(), "ether"), { from: owner });

    });

    it("Should stake for user1", async function () {
     await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });

     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 0, { from: user1 });

     const balance = await this.dai.balanceOf(this.stakingRewards.address);
     expect(balance).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));

     const stakeTokenBalance = await this.stakingRewards.balanceOf(user1);
     expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((1.1).toString(), "ether")); // Stake Token minted = amount staked + reward calculated

     var result = await this.stakingRewards.stakingDetails(user1, 1);

     expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));
     expect(result.reward).to.be.bignumber.equal(web3.utils.toWei((0.1).toString(), "ether"));
    });

    it("Should stake for user2", async function () {
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user2 });

      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 1, { from: user2 });

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      const stakeTokenBalance = await this.stakingRewards.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((12).toString(), "ether")); // Stake Token minted = amount staked + reward calculated

      var result = await this.stakingRewards.stakingDetails(user2, 1);

      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));
      expect(result.reward).to.be.bignumber.equal(web3.utils.toWei((2).toString(), "ether"));
    });

    it("Should stake lesser amount if exceeding reward cap", async function () {
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((15).toString(), "ether"), { from: user2 });

      await this.stakingRewards.stake(web3.utils.toWei((15).toString(), "ether"), 1, { from: user2 });

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      const stakeTokenBalance = await this.stakingRewards.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((12).toString(), "ether")); // Stake Token minted = amount staked + reward calculated

      var result = await this.stakingRewards.stakingDetails(user2, 1);

      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));
      expect(result.reward).to.be.bignumber.equal(web3.utils.toWei((2).toString(), "ether"));
    });

    it("Should not stake if amount entered is 0", async function () {
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user3 });

      await expectRevert(
        this.stakingRewards.stake(
          0,
          1,
          {
            from: user3
          }),
        "StakingWithLockup: Cannot stake 0 tokens"
      );
    });

    it("Should not stake if duration index entered is greater than or equal to numDurations", async function () {
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user2 });

      await expectRevert(
        this.stakingRewards.stake(
          10,
          5,
          {
            from: user2
          }),
        "StakingWithLockup: Please enter valid staking duration index"
      );
    });

    it("Should not stake if reward cap has been met(rewards allocated for that duration have been distributed)", async function () {
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user2 });

      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 1, { from: user2 });

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      const stakeTokenBalance = await this.stakingRewards.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((12).toString(), "ether")); // Stake Token minted = amount staked + reward calculated

      await expectRevert(
        this.stakingRewards.stake(
          1,
          1,
          {
            from: user2
          }),
        "StakingWithLockup: Rewards allocated for this duration have been distributed"
      );
    });

  });

  // describe("withdraw() and massWithdraw()", function () {

  //   beforeEach(async function () {

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     await this.stakingRewards.initialize(
  //       this.vault.address,
  //       this.slice.address,
  //       this.dai.address,
  //       [10, 20, 30, 40, 50],
  //       10000,
  //       {
  //         from: owner
  //       }
  //     );

  //     await this.stakingRewards.setDurations([20, 40, 60, 80, 100], { from: owner });

  //     await this.dai.transfer(user1, web3.utils.toWei((100).toString(), "ether"), { from: owner });
  //     await this.dai.transfer(user2, web3.utils.toWei((100).toString(), "ether"), { from: owner });
  //     await this.dai.transfer(user3, web3.utils.toWei((100).toString(), "ether"), { from: owner });

  //     await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });
  //     await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user2 });
  //     await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user3 });

  //   });

  //   it("Should withdraw with penalty for user1", async function () {

  //     const currentTime = await time.latest();
  //     const halfWay = Number(currentTime) + Number(time.duration.seconds(10));
      
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 0, { from: user1 });
      
  //     await time.increaseTo(halfWay);

  //     await this.stakingRewards.withdraw(1, { from: user1 });

  //     const balance = await this.dai.balanceOf(this.stakingRewards.address);
  //     expect(balance).to.be.bignumber.equal(web3.utils.toWei((0.05).toString(), "ether"));

  //     var result = await this.stakingRewards.stakingDetails(user1, 1);
  //     expect(result.amount).to.be.bignumber.equal(new BN("0"));

  //     const totalPenalty = await this.stakingRewards.totalPenaltyCollected();
  //     expect(totalPenalty).to.be.bignumber.equal(web3.utils.toWei((0.05).toString(), "ether"));
  //   });

  //   it("Should withdraw with penalty for user3", async function () {
  //     const currentTime = await time.latest();
  //     const to = Number(currentTime) + Number(time.duration.seconds(45)); // 75% complete
      
  //     await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 2, { from: user3 });
      
  //     await time.increaseTo(to);

  //     await this.stakingRewards.withdraw(1, { from: user3 });

  //     const balance = await this.dai.balanceOf(this.stakingRewards.address);
  //     expect(balance).to.be.bignumber.equal(web3.utils.toWei((0.25).toString(), "ether"));

  //     var result = await this.stakingRewards.stakingDetails(user3, 1);
  //     expect(result.amount).to.be.bignumber.equal(new BN("0"));

  //     const totalPenalty = await this.stakingRewards.totalPenaltyCollected();
  //     expect(totalPenalty).to.be.bignumber.equal(web3.utils.toWei((0.25).toString(), "ether"));
  //   });

  //   it("Should not withdraw if staking duration has passed", async function () {
  //     const currentTime = await time.latest();
  //     const to = Number(currentTime) + Number(time.duration.seconds(40));
      
  //     await this.stakingRewards.stake(web3.utils.toWei((5).toString(), "ether"), 1, { from: user2 });
      
  //     await time.increaseTo(to);

      
  //     await expectRevert(
  //       this.stakingRewards.withdraw(1, { from: user2 }),
  //       "StakingWithLockup: Cannot withdraw after endTime, please claim"
  //     );
      
  //     const balance = await this.dai.balanceOf(this.stakingRewards.address);
  //     expect(balance).to.be.bignumber.equal(web3.utils.toWei((5).toString(), "ether"));

  //     var result = await this.stakingRewards.stakingDetails(user2, 1);

  //     expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((5).toString(), "ether"));
  //   });

  //   it("Should mass withdraw with penalties for user1", async function () {

  //     const currentTime = await time.latest();
  //     const to = Number(currentTime) + Number(time.duration.seconds(10));
      
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 0, { from: user1 });
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 1, { from: user1 });
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 4, { from: user1 });
      
  //     await time.increaseTo(to);

  //     await this.stakingRewards.massWithdraw([1, 2, 3], { from: user1 });

  //     var balance = await this.dai.balanceOf(this.stakingRewards.address);
  //     expect(balance).to.be.bignumber.equal(web3.utils.toWei((0.215).toString(), "ether"));

  //     var result = await this.stakingRewards.stakingDetails(user1, 1);
  //     expect(result.amount).to.be.bignumber.equal(new BN("0"));

  //     result = await this.stakingRewards.stakingDetails(user1, 2);
  //     expect(result.amount).to.be.bignumber.equal(new BN("0"));

  //     result = await this.stakingRewards.stakingDetails(user1, 3);
  //     expect(result.amount).to.be.bignumber.equal(new BN("0"));

  //     var totalPenalty = await this.stakingRewards.totalPenaltyCollected();
  //     expect(totalPenalty).to.be.bignumber.equal(web3.utils.toWei((0.215).toString(), "ether")); // 5% + 7.5% + 9%
  //   });

  //   it("Should not mass withdraw for user1 even if one stake has reached maturity", async function () {
  //     const currentTime = await time.latest();
  //     const to = Number(currentTime) + Number(time.duration.seconds(21));
      
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 0, { from: user1 });
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 1, { from: user1 });
  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 4, { from: user1 });
      
  //     await time.increaseTo(to);

  //     await expectRevert(
  //       this.stakingRewards.massWithdraw([2, 1, 3], { from: user1 }),
  //       "StakingWithLockup: Cannot withdraw after endTime, please claim"
  //     );

  //     var balance = await this.dai.balanceOf(this.stakingRewards.address);
  //     expect(balance).to.be.bignumber.equal(web3.utils.toWei((3).toString(), "ether"));

  //     var result = await this.stakingRewards.stakingDetails(user1, 1);
  //     expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));

  //     result = await this.stakingRewards.stakingDetails(user1, 2);
  //     expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));

  //     result = await this.stakingRewards.stakingDetails(user1, 3);
  //     expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));

  //     var totalPenalty = await this.stakingRewards.totalPenaltyCollected();
  //     expect(totalPenalty).to.be.bignumber.equal(new BN("0"));
  //   });

  // });

  describe("claim() and massClaim()", function () {

    beforeEach(async function () {

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      await this.stakingRewards.initialize(
        this.vault.address,
        this.slice.address,
        this.dai.address,
        [1000, 2000, 3000, 4000, 5000],
        [
          web3.utils.toWei((1).toString(), "ether"),
          web3.utils.toWei((2).toString(), "ether"),
          web3.utils.toWei((3).toString(), "ether"),
          web3.utils.toWei((4).toString(), "ether"),
          web3.utils.toWei((5).toString(), "ether")
        ],
        [20, 40, 60, 80, 100],
        "Stake Token",
        "STK",
        {
          from: owner
        }
      );

      await this.dai.transfer(user1, web3.utils.toWei((100).toString(), "ether"), { from: owner });
      await this.dai.transfer(user2, web3.utils.toWei((100).toString(), "ether"), { from: owner });
      await this.dai.transfer(user3, web3.utils.toWei((100).toString(), "ether"), { from: owner });

      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((100).toString(), "ether"), { from: user2 });
      await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((100).toString(), "ether"), { from: user3 });

      await this.vault.setAllowance(this.stakingRewards.address, web3.utils.toWei((1000).toString(), "ether"), { from: owner });

    });

    it("Should claim for user1", async function () {

      const currentTime = await time.latest();
      const maturity = Number(currentTime) + Number(time.duration.seconds(20));
      
      await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 0, { from: user1 });
      
      await time.increaseTo(maturity);

      var stakeTokenBalance = await this.stakingRewards.balanceOf(user1);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((1.1).toString(), "ether"));

      await this.stakingRewards.claim(1, { from: user1 });

      stakeTokenBalance = await this.stakingRewards.balanceOf(user1);
      expect(stakeTokenBalance).to.be.bignumber.equal(new BN("0"));

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(new BN("0"));

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei((0.1).toString(), "ether"));

      var result = await this.stakingRewards.stakingDetails(user1, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should claim for user2", async function () {

      const currentTime = await time.latest();
      const maturity = Number(currentTime) + Number(time.duration.seconds(40));
      
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 1, { from: user2 });
      
      await time.increaseTo(maturity);

      var stakeTokenBalance = await this.stakingRewards.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((12).toString(), "ether"));

      await this.stakingRewards.claim(1, { from: user2 });

      stakeTokenBalance = await this.stakingRewards.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(new BN("0"));

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(new BN("0"));

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei((2).toString(), "ether"));

      var result = await this.stakingRewards.stakingDetails(user2, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should not claim if staking duration has not ended", async function () {
      const currentTime = await time.latest();
      const early = Number(currentTime) + Number(time.duration.seconds(40));
      
      await this.stakingRewards.stake(web3.utils.toWei((5).toString(), "ether"), 2, { from: user3 });
      
      await time.increaseTo(early);

      await expectRevert(
        this.stakingRewards.claim(1, { from: user3 }),
        "StakingWithLockup: Cannot claim reward before endTime"
      );

      var stakeTokenBalance = await this.stakingRewards.balanceOf(user3);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((6.5).toString(), "ether"));
      
      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((5).toString(), "ether"));

      const reward = await this.slice.balanceOf(user3);
      expect(reward).to.be.bignumber.equal(new BN("0"));

      var result = await this.stakingRewards.stakingDetails(user3, 1);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((5).toString(), "ether"));
      expect(result.reward).to.be.bignumber.equal(web3.utils.toWei((1.5).toString(), "ether"));
    });

    it("Should not be able to claim twice", async function () {
      const currentTime = await time.latest();
      const early = Number(currentTime) + Number(time.duration.seconds(61));
      
      await this.stakingRewards.stake(web3.utils.toWei((5).toString(), "ether"), 2, { from: user3 });
      
      await time.increaseTo(early);

      var stakeTokenBalance = await this.stakingRewards.balanceOf(user3);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((6.5).toString(), "ether"));

      await this.stakingRewards.claim(1, { from: user3 });

      stakeTokenBalance = await this.stakingRewards.balanceOf(user3);
      expect(stakeTokenBalance).to.be.bignumber.equal(new BN("0"));

      await expectRevert(
        this.stakingRewards.claim(1, { from: user3 }),
        "StakingWithLockup: Stake does not exist"
      );
      
      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(new BN("0"));

      const reward = await this.slice.balanceOf(user3);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei((1.5).toString(), "ether"));

      var result = await this.stakingRewards.stakingDetails(user3, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should mass claim for user2", async function () {

      const currentTime = await time.latest();
      const maturity = Number(currentTime) + Number(time.duration.seconds(61));
      
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 0, { from: user2 });
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 1, { from: user2 });
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 2, { from: user2 });
      
      await time.increaseTo(maturity);

      await this.stakingRewards.massClaim([1, 2, 3], { from: user2 });

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(new BN("0"));

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei((6).toString(), "ether"));

      var result = await this.stakingRewards.stakingDetails(user2, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));

      result = await this.stakingRewards.stakingDetails(user2, 2);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));

      result = await this.stakingRewards.stakingDetails(user2, 3);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));
    });

    it("Should not mass claim if any one of the stakes does not exist(already been claimed or never staked)", async function () {

      const currentTime = await time.latest();
      const maturity = Number(currentTime) + Number(time.duration.seconds(61));
      
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 0, { from: user2 });
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 1, { from: user2 });
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 2, { from: user2 });
      
      await time.increaseTo(maturity);

      await this.stakingRewards.claim(1, { from: user2 });

      await expectRevert(
        this.stakingRewards.massClaim([1, 2, 3], { from: user2 }),
        "StakingWithLockup: Stake does not exist"
      );

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((20).toString(), "ether"));

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));

      var result = await this.stakingRewards.stakingDetails(user2, 1);
      expect(result.amount).to.be.bignumber.equal(new BN("0"));

      result = await this.stakingRewards.stakingDetails(user2, 2);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      result = await this.stakingRewards.stakingDetails(user2, 3);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));
    });

    it("Should not mass claim for user2 if maturity period is not over for at least one stake", async function () {

      const currentTime = await time.latest();
      const maturity = Number(currentTime) + Number(time.duration.seconds(55));
      
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 0, { from: user2 });
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 1, { from: user2 });
      await this.stakingRewards.stake(web3.utils.toWei((10).toString(), "ether"), 2, { from: user2 });
      
      await time.increaseTo(maturity);

      await expectRevert(
        this.stakingRewards.massClaim([1, 2, 3], { from: user2 }),
        "StakingWithLockup: Cannot claim reward before endTime"
      );

      var stakeTokenBalance = await this.stakingRewards.balanceOf(user2);
      expect(stakeTokenBalance).to.be.bignumber.equal(web3.utils.toWei((36).toString(), "ether"));

      const balance = await this.dai.balanceOf(this.stakingRewards.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((30).toString(), "ether"));

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(new BN("0"));

      var result = await this.stakingRewards.stakingDetails(user2, 1);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      result = await this.stakingRewards.stakingDetails(user2, 2);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      result = await this.stakingRewards.stakingDetails(user2, 3);
      expect(result.amount).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));
    });

  });

  describe("setRewardDetails()", function () {

    beforeEach(async function () {

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      await this.stakingRewards.initialize(
        this.vault.address,
        this.slice.address,
        this.dai.address,
        [1000, 2000, 3000, 4000, 5000],
        [
          web3.utils.toWei((1).toString(), "ether"),
          web3.utils.toWei((2).toString(), "ether"),
          web3.utils.toWei((3).toString(), "ether"),
          web3.utils.toWei((4).toString(), "ether"),
          web3.utils.toWei((5).toString(), "ether")
        ],
        [20, 40, 60, 80, 100],
        "Stake Token",
        "STK",
        {
          from: owner
        }
      );
    });

    it("Should set details", async function () {
      await this.stakingRewards.setRewardDetails(
        [10, 20, 30, 40, 50],
        [
          web3.utils.toWei((5).toString(), "ether"),
          web3.utils.toWei((4).toString(), "ether"),
          web3.utils.toWei((3).toString(), "ether"),
          web3.utils.toWei((2).toString(), "ether"),
          web3.utils.toWei((1).toString(), "ether")
        ],
        [100, 200, 300, 400, 500],
        {
          from: owner
        }
      );

      // 1st duration
      var duration = await this.stakingRewards.durations(0);
      expect(duration).to.be.bignumber.equal(new BN("10"));

      var reward = await this.stakingRewards.percentageRewards(0);
      expect(reward).to.be.bignumber.equal(new BN("100"));

      var rewardCap = await this.stakingRewards.rewardCapForDuration(0);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((5).toString(), "ether"));

      // 2nd duration
      duration = await this.stakingRewards.durations(1);
      expect(duration).to.be.bignumber.equal(new BN("20"));

      reward = await this.stakingRewards.percentageRewards(1);
      expect(reward).to.be.bignumber.equal(new BN("200"));

      rewardCap = await this.stakingRewards.rewardCapForDuration(1);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((4).toString(), "ether"));

      // 3rd duration
      duration = await this.stakingRewards.durations(2);
      expect(duration).to.be.bignumber.equal(new BN("30"));

      reward = await this.stakingRewards.percentageRewards(2);
      expect(reward).to.be.bignumber.equal(new BN("300"));

      rewardCap = await this.stakingRewards.rewardCapForDuration(2);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((3).toString(), "ether"));

      // 4th duration
      duration = await this.stakingRewards.durations(3);
      expect(duration).to.be.bignumber.equal(new BN("40"));

      reward = await this.stakingRewards.percentageRewards(3);
      expect(reward).to.be.bignumber.equal(new BN("400"));

      rewardCap = await this.stakingRewards.rewardCapForDuration(3);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((2).toString(), "ether"));

      // 5th duration
      duration = await this.stakingRewards.durations(4);
      expect(duration).to.be.bignumber.equal(new BN("50"));

      reward = await this.stakingRewards.percentageRewards(4);
      expect(reward).to.be.bignumber.equal(new BN("500"));

      rewardCap = await this.stakingRewards.rewardCapForDuration(4);
      expect(rewardCap).to.be.bignumber.equal(web3.utils.toWei((1).toString(), "ether"));
    });

    it("Should not set durations if array length is not 5", async function () {
      await expectRevert(
        this.stakingRewards.setRewardDetails(
          [10, 20, 30, 40, 50, 60],
          [
            web3.utils.toWei((5).toString(), "ether"),
            web3.utils.toWei((4).toString(), "ether"),
            web3.utils.toWei((3).toString(), "ether"),
            web3.utils.toWei((2).toString(), "ether"),
            web3.utils.toWei((1).toString(), "ether")
          ],
          [100, 200, 300, 400, 500],
          { 
            from: owner
          }),
        "StakingWithLockup: Array lengths should be equal"
      );

      await expectRevert(
        this.stakingRewards.setRewardDetails(
          [10, 20, 30, 40, 50],
          [
            web3.utils.toWei((5).toString(), "ether"),
            web3.utils.toWei((4).toString(), "ether"),
            web3.utils.toWei((3).toString(), "ether"),
            web3.utils.toWei((2).toString(), "ether"),
            web3.utils.toWei((1).toString(), "ether")
          ],
          [100, 200, 300, 400, 500, 600],
          { 
            from: owner
          }),
        "StakingWithLockup: Array lengths should be equal"
      );
    });

    it("Should not set durations if not called by owner", async function () {
      await expectRevert(
        this.stakingRewards.setRewardDetails(
          [10, 20, 30, 40, 50],
          [
            web3.utils.toWei((5).toString(), "ether"),
            web3.utils.toWei((4).toString(), "ether"),
            web3.utils.toWei((3).toString(), "ether"),
            web3.utils.toWei((2).toString(), "ether"),
            web3.utils.toWei((1).toString(), "ether")
          ],
          [100, 200, 300, 400, 500],
          { 
            from: anotherAccount
          }),
        "Ownable: caller is not the owner"
      );
    });

  });

  // describe("setDurations()", function () {

  //   beforeEach(async function () {

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     await this.stakingRewards.initialize(
  //       this.vault.address,
  //       this.slice.address,
  //       this.dai.address,
  //       [10, 20, 30, 40, 50],
  //       10000,
  //       {
  //         from: owner
  //       }
  //     );

  //     await this.stakingRewards.setDurations([20, 40, 60, 80, 100], { from: owner });
  //   });

  //   it("Should set durations", async function () {
  //     await this.stakingRewards.setDurations([20, 40, 60, 80, 100], { from: owner });

  //     var duration = await this.stakingRewards.durations(0);
  //     expect(duration).to.be.bignumber.equal(new BN("20"));

  //     duration = await this.stakingRewards.durations(1);
  //     expect(duration).to.be.bignumber.equal(new BN("40"));

  //     duration = await this.stakingRewards.durations(2);
  //     expect(duration).to.be.bignumber.equal(new BN("60"));

  //     duration = await this.stakingRewards.durations(3);
  //     expect(duration).to.be.bignumber.equal(new BN("80"));

  //     duration = await this.stakingRewards.durations(4);
  //     expect(duration).to.be.bignumber.equal(new BN("100"));
  //   });

  //   it("Should not set durations if array length is not 5", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setDurations(
  //         [
  //           20,
  //           40,
  //           60,
  //           80,
  //           100,
  //           120
  //         ],
  //         { 
  //           from: owner
  //         }),
  //       "StakingWithLockup: Invalid array length"
  //     );

  //     await expectRevert(
  //       this.stakingRewards.setDurations(
  //         [
  //           20,
  //           40,
  //           60,
  //           80
  //         ],
  //         { 
  //           from: owner
  //         }),
  //       "StakingWithLockup: Invalid array length"
  //     );
  //   });

  //   it("Should not set durations if not called by owner", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setDurations(
  //         [
  //           20,
  //           40,
  //           60,
  //           80,
  //           100
  //         ],
  //         { 
  //           from: anotherAccount
  //         }),
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  // });

  // describe("setRewards()", function () {

  //   beforeEach(async function () {

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     await this.stakingRewards.initialize(
  //       this.vault.address,
  //       this.slice.address,
  //       this.dai.address,
  //       [10, 20, 30, 40, 50],
  //       10000,
  //       {
  //         from: owner
  //       }
  //     );

  //     await this.stakingRewards.setRewards([20, 40, 60, 80, 100], { from: owner });
  //   });

  //   it("Should set rewards", async function () {
  //     await this.stakingRewards.setRewards([20, 40, 60, 80, 100], { from: owner });

  //     var duration = await this.stakingRewards.rewardForDuration(0);
  //     expect(duration).to.be.bignumber.equal(new BN("20"));

  //     duration = await this.stakingRewards.rewardForDuration(1);
  //     expect(duration).to.be.bignumber.equal(new BN("40"));

  //     duration = await this.stakingRewards.rewardForDuration(2);
  //     expect(duration).to.be.bignumber.equal(new BN("60"));

  //     duration = await this.stakingRewards.rewardForDuration(3);
  //     expect(duration).to.be.bignumber.equal(new BN("80"));

  //     duration = await this.stakingRewards.rewardForDuration(4);
  //     expect(duration).to.be.bignumber.equal(new BN("100"));
  //   });

  //   it("Should not set rewards if array length is not 5", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setRewards(
  //         [
  //           20,
  //           40,
  //           60,
  //           80,
  //           100,
  //           120
  //         ],
  //         { 
  //           from: owner
  //         }),
  //       "StakingWithLockup: Invalid array length"
  //     );

  //     await expectRevert(
  //       this.stakingRewards.setRewards(
  //         [
  //           20,
  //           40,
  //           60,
  //           80
  //         ],
  //         { 
  //           from: owner
  //         }),
  //       "StakingWithLockup: Invalid array length"
  //     );
  //   });

  //   it("Should not set rewards if not called by owner", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setRewards(
  //         [
  //           20,
  //           40,
  //           60,
  //           80,
  //           100
  //         ],
  //         { 
  //           from: anotherAccount
  //         }),
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  // });

  // describe("setPenalty()", function () {

  //   beforeEach(async function () {

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     await this.stakingRewards.initialize(
  //       this.vault.address,
  //       this.slice.address,
  //       this.dai.address,
  //       [10, 20, 30, 40, 50],
  //       10000,
  //       {
  //         from: owner
  //       }
  //     );
  //   });

  //   it("Should set penalty", async function () {
  //     await this.stakingRewards.setPenalty(10000, { from: owner });

  //     const penalty = await this.stakingRewards.penalty();
  //     expect(penalty).to.be.bignumber.equal(new BN("10000"));
  //   });

  //   it("Should not set penalty if it is greater than or equal to 100000", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setPenalty(
  //         100000,
  //         { 
  //           from: owner
  //         }),
  //       "StakingWithLockup: Penalty should be less than 100%"
  //     );
  //   });

  //   it("Should not set penalty if not called by owner", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setPenalty(
  //         1000,
  //         { 
  //           from: anotherAccount
  //         }),
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  // });

  // describe("withdrawPenalty()", function () {

  //   beforeEach(async function () {

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     await this.stakingRewards.initialize(
  //       this.vault.address,
  //       this.slice.address,
  //       this.dai.address,
  //       [10, 20, 30, 40, 50],
  //       10000,
  //       {
  //         from: owner
  //       }
  //     );

  //     await this.stakingRewards.setDurations([20, 40, 60, 80, 100], { from: owner });

  //     await this.dai.transfer(user1, web3.utils.toWei((100).toString(), "ether"), { from: owner });
  //     await this.dai.transfer(user2, web3.utils.toWei((900).toString(), "ether"), { from: owner });

  //     await this.dai.approve(this.stakingRewards.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });

  //     await this.stakingRewards.stake(web3.utils.toWei((1).toString(), "ether"), 0, { from: user1 });
  //     await this.stakingRewards.withdraw(1, { from: user1 });
  //   });

  //   it("Should withdraw penalty", async function () {
  //     const contractBalance = await this.dai.balanceOf(this.stakingRewards.address);

  //     await this.stakingRewards.withdrawPenalty({ from: owner });

  //     const ownerBalance = await this.dai.balanceOf(owner);
  //     expect(ownerBalance).to.be.bignumber.equal(contractBalance);

  //     var penalty = await this.stakingRewards.totalPenaltyCollected();
  //     expect(penalty).to.be.bignumber.equal(new BN("0"));
  //   });

  //   it("Should not withdraw penalty if there is nothing to withdraw", async function () {
  //     await this.stakingRewards.withdrawPenalty({ from: owner });

  //     await expectRevert(
  //       this.stakingRewards.withdrawPenalty({ from: owner }),
  //       "StakingWithLockup: Nothing to withdraw"
  //     );

  //     var penalty = await this.stakingRewards.totalPenaltyCollected();
  //     expect(penalty).to.be.bignumber.equal(new BN("0"));
  //   });

  //   it("Should not withdraw if not called by the owner", async function () {
  //     await expectRevert(
  //       this.stakingRewards.withdrawPenalty({ from: anotherAccount }),
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  // });
});