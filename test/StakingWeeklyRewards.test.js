const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time,
  constants
} = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = constants;

const YieldFarm = contract.fromArtifact("YieldFarm");
const StakingMilestones = contract.fromArtifact("StakingMilestonesMock");
const StakingRewards = contract.fromArtifact("StakingWeeklyRewards");
const Vault = contract.fromArtifact("Vault");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("StakingWeeklyRewards", function () {
  const [owner, anotherAccount, user1, user2, user3] = accounts;

  const epochRewardCap = web3.utils.toWei((1000).toString(), "ether");
  var startTime;
  var currentTime;

  beforeEach(async function () {
    currentTime = await time.latest();
    startTime = Number(currentTime) + Number(time.duration.minutes(1));

    this.slice = await Token.new({
      from: owner
    });

    await this.slice.initialize(1000000000, "Jibrel Token", "SLICE", {
      from: owner
    });

    this.staking = await StakingMilestones.new(startTime, 5, {
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

    await this.dai.initialize(10, "DAIToken", "DAI", {
      from: owner,
    });

    this.yieldFarm = await YieldFarm.new({
      from: owner
    });

    await this.yieldFarm.initialize(
      this.slice.address,
      this.staking.address,
      this.dai.address,
      this.vault.address,
      epochRewardCap,
      {
        from: owner
      }
    );
  });

  // describe("deploy and initialize()", function () {

  //   it("Should initialize", async function () {
  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await this.stakingRewards.initialize(
  //       this.yieldFarm.address,
  //       stakableToken,
  //       1000,
  //       {
  //         from: owner
  //       }
  //     );

  //     const vault = await this.stakingRewards._vault();
  //     expect(vault).to.be.equal(this.vault.address);

  //     const staking = await this.stakingRewards._staking();
  //     expect(staking).to.be.equal(this.staking.address);

  //     const slice = await this.stakingRewards._slice();
  //     expect(slice).to.be.equal(this.slice.address);

  //     const dai = await this.stakingRewards._stakableToken();
  //     expect(dai).to.be.equal(this.dai.address);

  //     const reward = await this.stakingRewards.rewardPerTokenInEpoch(1);
  //     expect(reward).to.be.bignumber.equal(new BN("1000"));
  //   });

  //   it("Should not initialize if reward in YieldFarm is > 0", async function () {
  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await expectRevert(
  //       this.stakingRewards.initialize(
  //         this.yieldFarm.address,
  //         stakableToken,
  //         1000,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Reward distribution in YieldFarm still ongoing"
  //     );
  //   });

  //   it("Should not initialize if YieldFarm address is address(0)", async function () {
  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await expectRevert(
  //       this.stakingRewards.initialize(
  //         ZERO_ADDRESS,
  //         stakableToken,
  //         1000,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Invalid YieldFarm address"
  //     );
  //   });

  //   it("Should not initialize if stakable token address is address(0)", async function () {
  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await expectRevert(
  //       this.stakingRewards.initialize(
  //         this.yieldFarm.address,
  //         ZERO_ADDRESS,
  //         1000,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Invalid stakable token address"
  //     );
  //   });

  //   it("Should not initialize if _rewardPerTokenInEpoch is 0", async function () {
  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await expectRevert(
  //       this.stakingRewards.initialize(
  //         this.yieldFarm.address,
  //         stakableToken,
  //         0,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Reward should be greater than 0!"
  //     );
  //   });

  // });

  // describe("setRewardPerTokenInEpoch()", function () {

  //   beforeEach(async function () {
  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await this.stakingRewards.initialize(
  //       this.yieldFarm.address,
  //       stakableToken,
  //       1000,
  //       {
  //         from: owner
  //       }
  //     );
  //   });

  //   it("Should set reward", async function () {
  //     await this.stakingRewards.setRewardPerTokenInEpoch(1, 100, {
  //       from: owner
  //     });

  //     const reward = await this.stakingRewards.rewardPerTokenInEpoch(1);
  //     expect(reward).to.be.bignumber.equal(new BN(100).toString());
  //   });

  //   it("Should not set reward if epoch ID is in the past", async function () {
  //     const epoch3 = Number(startTime) + Number(time.duration.seconds(10));

  //     await time.increaseTo(epoch3);

  //     await expectRevert(
  //       this.stakingRewards.setRewardPerTokenInEpoch(
  //         1,
  //         100,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Epoch ID should be greater than the current epoch ID"
  //     );

  //     await expectRevert(
  //       this.stakingRewards.setRewardPerTokenInEpoch(
  //         2,
  //         500,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Epoch ID should be greater than the current epoch ID"
  //     );
  //   });

  //   it("Should not set reward if not called by owner", async function () {
  //     await expectRevert(
  //       this.stakingRewards.setRewardPerTokenInEpoch(
  //         1,
  //         10,
  //         {
  //           from: anotherAccount
  //         }),
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  // });

  // describe("initEpoch()", function () {

  //   beforeEach(async function () {
  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await this.stakingRewards.initialize(
  //       this.yieldFarm.address,
  //       stakableToken,
  //       1000,
  //       {
  //         from: owner
  //       }
  //     );
  //   });

  //   it("Should initialize epoch", async function () {
  //     await this.stakingRewards.initEpoch(2, {
  //       from: owner
  //     });

  //     const reward = await this.stakingRewards.rewardPerTokenInEpoch(2);
  //     expect(reward).to.be.bignumber.equal(new BN(1000).toString());
  //   });

  //   it("Should not initialize epoch if already initialized", async function () {
  //     await this.stakingRewards.initEpoch(2, {
  //       from: owner
  //     });

  //     await expectRevert(
  //       this.stakingRewards.initEpoch(
  //         2,
  //         {
  //           from: owner
  //         }),
  //       "StakingWeeklyRewards: Epoch already initialized"
  //     );
  //   });

  //   it("Should not initialize epoch if previous epoch not initialized", async function () {
  //     await expectRevert(
  //       this.stakingRewards.initEpoch(
  //         3,
  //         {
  //           from: anotherAccount
  //         }),
  //       "StakingWeeklyRewards: Previous epoch not initialized"
  //     );
  //   });

  //   it("Should not initialize epoch if epoch is in the past", async function () {
  //     await expectRevert(
  //       this.stakingRewards.initEpoch(
  //         1,
  //         {
  //           from: anotherAccount
  //         }),
  //       "StakingWeeklyRewards: Epoch is in the past"
  //     );
  //   });

  // });

  describe("getTotalAccruedRewards()", function () {

    beforeEach(async function () {

      for (var i = 1; i <= 4; i++) {
        await this.staking.setEpochUserBalance(
          user1,
          this.dai.address,
          i,
          web3.utils.toWei((10).toString(), "ether")
        );

        await this.staking.setEpochUserBalance(
          user2,
          this.dai.address,
          i,
          web3.utils.toWei((40).toString(), "ether")
        );

        await this.staking.setEpochUserBalance(
          user3,
          this.dai.address,
          i,
          web3.utils.toWei((10).toString(), "ether")
        );
      }

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        5,
        web3.utils.toWei((20).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        5,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        6,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        7,
        web3.utils.toWei((50).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user3,
        this.dai.address,
        5,
        web3.utils.toWei((10).toString(), "ether")
      );

      for (var j = 6; j <= 15; j++) {
        await this.staking.setEpochUserBalance(
          user1,
          this.dai.address,
          j,
          web3.utils.toWei((30).toString(), "ether")
        );

        await this.staking.setEpochUserBalance(
          user3,
          this.dai.address,
          j,
          web3.utils.toWei((10).toString(), "ether")
        );
      }

      await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
        from: owner
      });

      await time.increaseTo(startTime);

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      const stakableToken = await this.yieldFarm._stakableToken();

      await this.stakingRewards.initialize(
        this.yieldFarm.address,
        stakableToken,
        100,
        {
          from: owner
        }
      );

      await this.vault.setAllowance(
        this.stakingRewards.address,
        web3.utils.toWei((10000).toString(), "ether"),
        {
          from: owner
        }
      );

    });

    it("Should return correct accrued rewards for user1", async function () {
      await this.stakingRewards.initEpoch(2, { from: owner });
      await this.stakingRewards.initEpoch(3, { from: owner });
      await this.stakingRewards.initEpoch(4, { from: owner });
      await this.stakingRewards.initEpoch(5, { from: owner });
      await this.stakingRewards.initEpoch(6, { from: owner });
      await this.stakingRewards.initEpoch(7, { from: owner });
      await this.stakingRewards.initEpoch(8, { from: owner });
      await this.stakingRewards.initEpoch(9, { from: owner });
      await this.stakingRewards.initEpoch(10, { from: owner });
      await this.stakingRewards.initEpoch(11, { from: owner });
      await this.stakingRewards.initEpoch(12, { from: owner });

      const epoch7 = Number(startTime) + Number(time.duration.seconds(30));

      await time.increaseTo(epoch7);

      const currentEpoch = await this.stakingRewards.rewardPerTokenInEpoch(12);
      console.log(currentEpoch);

      var user1Reward = await this.stakingRewards.getTotalAccruedRewards(user1);

      expect(user1Reward).to.be.bignumber.equal(new BN("9000"));

      const epoch13 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch13);

      user1Reward = await this.stakingRewards.getTotalAccruedRewards(user1);

      expect(user1Reward).to.be.bignumber.equal(new BN("27000"));
    });

    // it("Should return correct accrued rewards for user2", async function () {
    //   const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

    //   await time.increaseTo(epoch7);

    //   var user2Reward = await this.stakingRewards.getTotalAccruedRewards(user2);

    //   expect(user2Reward).to.be.bignumber.equal(web3.utils.toWei((800).toString(), "ether"));
    // });

    // it("Should return correct accrued rewards for user3", async function () {
    //   const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

    //   await time.increaseTo(epoch7);

    //   var user3Reward = await this.stakingRewards.getTotalAccruedRewards(user3);

    //   expect(user3Reward).to.be.bignumber.equal(web3.utils.toWei((200).toString(), "ether"));

    //   const epoch16 = Number(startTime) + Number(time.duration.minutes(2)) + Number(time.duration.seconds(30));

    //   await time.increaseTo(epoch16);

    //   user3Reward = await this.stakingRewards.getTotalAccruedRewards(user3);

    //   expect(user3Reward).to.be.bignumber.equal(web3.utils.toWei((500).toString(), "ether"));
    // });

  });

  // describe("claim()", function () {

  //   beforeEach(async function () {

  //     for (var i = 1; i <= 4; i++) {
  //       await this.staking.setEpochUserBalance(
  //         user1,
  //         this.dai.address,
  //         i,
  //         web3.utils.toWei((10).toString(), "ether")
  //       );

  //       await this.staking.setEpochUserBalance(
  //         user2,
  //         this.dai.address,
  //         i,
  //         web3.utils.toWei((40).toString(), "ether")
  //       );

  //       await this.staking.setEpochUserBalance(
  //         user3,
  //         this.dai.address,
  //         i,
  //         web3.utils.toWei((10).toString(), "ether")
  //       );
  //     }

  //     await this.staking.setEpochUserBalance(
  //       user1,
  //       this.dai.address,
  //       5,
  //       web3.utils.toWei((20).toString(), "ether")
  //     );

  //     await this.staking.setEpochUserBalance(
  //       user2,
  //       this.dai.address,
  //       5,
  //       web3.utils.toWei((40).toString(), "ether")
  //     );

  //     await this.staking.setEpochUserBalance(
  //       user2,
  //       this.dai.address,
  //       6,
  //       web3.utils.toWei((40).toString(), "ether")
  //     );

  //     await this.staking.setEpochUserBalance(
  //       user2,
  //       this.dai.address,
  //       7,
  //       web3.utils.toWei((50).toString(), "ether")
  //     );

  //     await this.staking.setEpochUserBalance(
  //       user3,
  //       this.dai.address,
  //       5,
  //       web3.utils.toWei((10).toString(), "ether")
  //     );

  //     for (var j = 6; j <= 15; j++) {
  //       await this.staking.setEpochUserBalance(
  //         user1,
  //         this.dai.address,
  //         j,
  //         web3.utils.toWei((30).toString(), "ether")
  //       );

  //       await this.staking.setEpochUserBalance(
  //         user3,
  //         this.dai.address,
  //         j,
  //         web3.utils.toWei((10).toString(), "ether")
  //       );
  //     }

  //     await this.yieldFarm.setTotalRewardInParticularEpoch(1, 0, {
  //       from: owner
  //     });

  //     await time.increaseTo(startTime);

  //     this.stakingRewards = await StakingRewards.new({
  //       from: owner
  //     });

  //     const stakableToken = await this.yieldFarm._stakableToken();

  //     await this.stakingRewards.initialize(
  //       this.yieldFarm.address,
  //       stakableToken,
  //       100,
  //       {
  //         from: owner
  //       }
  //     );

  //     await this.vault.setAllowance(
  //       this.stakingRewards.address,
  //       web3.utils.toWei((10000).toString(), "ether"),
  //       {
  //         from: owner
  //       }
  //     );

  //   });

  //   it("Should claim for user1", async function () {
  //     const epoch7 = Number(startTime) + Number(time.duration.seconds(30));

  //     await time.increaseTo(epoch7);

  //     await this.stakingRewards.claim({ from: user1 });

  //     var balance = await this.slice.balanceOf(user1);

  //     expect(balance).to.be.bignumber.equal(new BN("9000"));

  //     const epoch13 = Number(startTime) + Number(time.duration.minutes(1));

  //     await time.increaseTo(epoch13);

  //     await this.stakingRewards.claim({ from: user1 });

  //     balance = await this.slice.balanceOf(user1);

  //     expect(balance).to.be.bignumber.equal(new BN("27000"));
  //   });

  //   it("Should claim for user2", async function () {
  //     const epoch7 = Number(startTime) + Number(time.duration.seconds(30));

  //     await time.increaseTo(epoch7);

  //     await this.stakingRewards.claim({ from: user2 });

  //     var balance = await this.slice.balanceOf(user2);

  //     expect(balance).to.be.bignumber.equal(new BN("24000"));
  //   });

  //   it("Should claim for user3", async function () {
  //     const epoch7 = Number(startTime) + Number(time.duration.seconds(30));

  //     await time.increaseTo(epoch7);

  //     await this.stakingRewards.claim({ from: user3 });

  //     var balance = await this.slice.balanceOf(user3);

  //     expect(balance).to.be.bignumber.equal(new BN("6000"));

  //     const epoch16 = Number(startTime) + Number(time.duration.minutes(1)) + Number(time.duration.seconds(20));

  //     await time.increaseTo(epoch16);

  //     await this.stakingRewards.claim({ from: user3 });

  //     balance = await this.slice.balanceOf(user3);

  //     expect(balance).to.be.bignumber.equal(new BN("15000"));
  //   });

  // });

});
