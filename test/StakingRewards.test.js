const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time
} = require("@openzeppelin/test-helpers");

const YieldFarm = contract.fromArtifact("YieldFarm");
const StakingMilestones = contract.fromArtifact("StakingMilestonesMock");
const StakingRewards = contract.fromArtifact("StakingRewardsMock");
const Vault = contract.fromArtifact("Vault");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("StakingRewards", function () {
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

    this.staking = await StakingMilestones.new(startTime, 10, {
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

  describe("deploy and initialize()", function () {

    it("Should initialize", async function () {
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
        {
          from: owner
        }
      );

      const vault = await this.stakingRewards._vault();
      expect(vault).to.be.equal(this.vault.address);

      const staking = await this.stakingRewards._staking();
      expect(staking).to.be.equal(this.staking.address);

      const slice = await this.stakingRewards._slice();
      expect(slice).to.be.equal(this.slice.address);

      const dai = await this.stakingRewards._stakableToken();
      expect(dai).to.be.equal(this.dai.address);

      const yieldFarmAddress = await this.stakingRewards._yieldFarm();
      expect(yieldFarmAddress).to.be.equal(this.yieldFarm.address);
    });

    it("Should not initialize if reward in YieldFarm is > 0", async function () {
      await time.increaseTo(startTime);

      this.stakingRewards = await StakingRewards.new({
        from: owner
      });

      const stakableToken = await this.yieldFarm._stakableToken();

      await expectRevert(
        this.stakingRewards.initialize(
          this.yieldFarm.address,
          stakableToken,
          {
            from: owner
          }),
        "StakingRewards: Reward distribution in YieldFarm still ongoing"
      );
    });

  });

  describe("setRewards()", function () {

    beforeEach(async function () {
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
        {
          from: owner
        }
      );
    });

    it("Should set rewards", async function () {
      await this.stakingRewards.setRewards([10, 20, 30, 40, 50], {
        from: owner
      });

      const reward1 = await this.stakingRewards.reward(1);
      expect(reward1).to.be.bignumber.equal(new BN(10).toString());

      const reward2 = await this.stakingRewards.reward(2);
      expect(reward2).to.be.bignumber.equal(new BN(20).toString());

      const reward3 = await this.stakingRewards.reward(3);
      expect(reward3).to.be.bignumber.equal(new BN(30).toString());

      const reward4 = await this.stakingRewards.reward(4);
      expect(reward4).to.be.bignumber.equal(new BN(40).toString());

      const reward5 = await this.stakingRewards.reward(5);
      expect(reward5).to.be.bignumber.equal(new BN(50).toString());
    });

    it("Should not set rewards if array length is not 5", async function () {
      await expectRevert(
        this.stakingRewards.setRewards(
          [
            10,
            20,
            30,
            40
          ],
          {
            from: owner
          }),
        "StakingRewards: Invalid array length"
      );

      await expectRevert(
        this.stakingRewards.setRewards(
          [
            10,
            20,
            30,
            40,
            50,
            60
          ],
          {
            from: owner
          }),
        "StakingRewards: Invalid array length"
      );
    });

    it("Should not set rewards if not called by owner", async function () {
      await expectRevert(
        this.stakingRewards.setRewards(
          [
            10,
            20,
            30,
            40,
            50
          ],
          {
            from: anotherAccount
          }),
        "Ownable: caller is not the owner"
      );
    });

  });

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
        {
          from: owner
        }
      );

      await this.stakingRewards.setRewardDurations(
        [
          30,
          60,
          90,
          120,
          150
        ],
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

      await this.stakingRewards.setRewards([10, 20, 30, 40, 50], {
        from: owner
      });

    });

    it("Should return correct accrued rewards for user1", async function () {
      const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch7);

      var user1Reward = await this.stakingRewards.getTotalAccruedRewards(user1);

      expect(user1Reward).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));

      const epoch13 = Number(startTime) + Number(time.duration.minutes(2));

      await time.increaseTo(epoch13);

      user1Reward = await this.stakingRewards.getTotalAccruedRewards(user1);

      expect(user1Reward).to.be.bignumber.equal(web3.utils.toWei((700).toString(), "ether"));
    });

    it("Should return correct accrued rewards for user2", async function () {
      const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch7);

      var user2Reward = await this.stakingRewards.getTotalAccruedRewards(user2);

      expect(user2Reward).to.be.bignumber.equal(web3.utils.toWei((800).toString(), "ether"));
    });

    it("Should return correct accrued rewards for user3", async function () {
      const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch7);

      var user3Reward = await this.stakingRewards.getTotalAccruedRewards(user3);

      expect(user3Reward).to.be.bignumber.equal(web3.utils.toWei((200).toString(), "ether"));

      const epoch16 = Number(startTime) + Number(time.duration.minutes(2)) + Number(time.duration.seconds(30));

      await time.increaseTo(epoch16);

      user3Reward = await this.stakingRewards.getTotalAccruedRewards(user3);

      expect(user3Reward).to.be.bignumber.equal(web3.utils.toWei((500).toString(), "ether"));
    });

  });

  describe("harvest()", function () {

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
        {
          from: owner
        }
      );

      await this.stakingRewards.setRewardDurations(
        [
          30,
          60,
          90,
          120,
          150
        ],
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

      await this.stakingRewards.setRewards([10, 20, 30, 40, 50], {
        from: owner
      });

    });

    it("Should harvest for user1", async function () {
      const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch7);

      await this.stakingRewards.harvest({ from: user1 });

      var balance = await this.slice.balanceOf(user1);

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));

      const epoch13 = Number(startTime) + Number(time.duration.minutes(2));

      await time.increaseTo(epoch13);

      await this.stakingRewards.harvest({ from: user1 });

      balance = await this.slice.balanceOf(user1);

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((700).toString(), "ether"));
    });

    it("Should harvest for user2", async function () {
      const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch7);

      await this.stakingRewards.harvest({ from: user2 });

      var balance = await this.slice.balanceOf(user2);

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((800).toString(), "ether"));
    });

    it("Should harvest for user3", async function () {
      const epoch7 = Number(startTime) + Number(time.duration.minutes(1));

      await time.increaseTo(epoch7);

      await this.stakingRewards.harvest({ from: user3 });

      var balance = await this.slice.balanceOf(user3);

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((200).toString(), "ether"));

      const epoch16 = Number(startTime) + Number(time.duration.minutes(2)) + Number(time.duration.seconds(30));

      await time.increaseTo(epoch16);

      await this.stakingRewards.harvest({ from: user3 });

      balance = await this.slice.balanceOf(user3);

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((500).toString(), "ether"));
    });

  });

});
