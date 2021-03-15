const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time,
} = require("@openzeppelin/test-helpers");

const YieldFarm = contract.fromArtifact("YieldFarm");
const StakingMilestones = contract.fromArtifact("StakingMilestonesMock");
const Vault = contract.fromArtifact("Vault");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("YieldFarm", function () {
  const [owner, anotherAccount, user1, user2] = accounts;

  const epochRewardCap = web3.utils.toWei((1000).toString(), "ether");
  var startTime;
  var currentTime;

  beforeEach(async function () {
    currentTime = await time.latest();
    startTime = Number(currentTime) + Number(time.duration.minutes(5));

    this.slice = await Token.new({
      from: owner
    });

    await this.slice.initialize(1000000000, "Jibrel Token", "SLICE", {
      from: owner
    });

    this.staking = await StakingMilestones.new(startTime, 60, {
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

  describe("initialize()", function () {
    it("Should initialize properly", async function () {
      const vault = await this.yieldFarm._vault();
      expect(vault).to.be.equal(this.vault.address);

      const staking = await this.yieldFarm._staking();
      expect(staking).to.be.equal(this.staking.address);

      const slice = await this.yieldFarm._slice();
      expect(slice).to.be.equal(this.slice.address);

      const dai = await this.yieldFarm._stakableToken();
      expect(dai).to.be.equal(this.dai.address);

      const totalReward = await this.yieldFarm.totalRewardInEpoch(1);
      expect(totalReward).to.be.bignumber.equal(epochRewardCap);
    });
  });

  describe("setTotalRewardInParticularEpoch()", function () {
    it("Should set total reward in particular epoch", async function () {
      await this.yieldFarm.setTotalRewardInParticularEpoch(1, 1000, {
        from: owner
      });

      const reward = await this.yieldFarm.totalRewardInEpoch(1);
      expect(reward).to.be.bignumber.equal(new BN(1000).toString());
    });

    it("Should not set total reward in particular epoch if not called by owner", async function () {
      await expectRevert(
        this.yieldFarm.setTotalRewardInParticularEpoch(1, 1000, {
          from: anotherAccount
        }),
        "Ownable: caller is not the owner"
      );
    });

    it("Should not set total reward in particular epoch if epoch has passed or going on", async function () {
      await time.increaseTo(startTime);

      await expectRevert(
        this.yieldFarm.setTotalRewardInParticularEpoch(1, 1000, {
          from: owner
        }),
        "YieldFarm: Epoch ID should be greater than the current epoch ID"
      );
    });
  });

  describe("harvest()", function () {
    beforeEach(async function () {
      await this.slice.transfer(
        this.vault.address,
        web3.utils.toWei((10000).toString(), "ether"),
        { from: owner }
      );

      await this.vault.setAllowance(
        this.yieldFarm.address,
        web3.utils.toWei((10000).toString(), "ether"),
        { from: owner }
      );

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        1,
        web3.utils.toWei((10).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        1,
        web3.utils.toWei((30).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        2,
        web3.utils.toWei((20).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
    });

    it("Should harvest for user1 after epoch 1", async function () {
      const epoch1 =
        Number(await time.latest()) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await this.yieldFarm.harvest(1, { from: user1 });

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((250).toString(), "ether")
      );
    });

    it("Should harvest for user2 after epoch 1", async function () {
      const epoch1 =
        Number(await time.latest()) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await this.yieldFarm.harvest(1, { from: user2 });

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((750).toString(), "ether")
      );
    });

    it("Should harvest for user1 after epoch 2", async function () {
      const epoch2 =
        Number(await time.latest()) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await this.yieldFarm.harvest(1, { from: user1 });
      await this.yieldFarm.harvest(2, { from: user1 });

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((1000).toString(), "ether")
      );
    });

    it("Should harvest for user2 after epoch 2", async function () {
      const epoch2 =
        Number(await time.latest()) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await this.yieldFarm.harvest(1, { from: user2 });
      await this.yieldFarm.harvest(2, { from: user2 });

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((1000).toString(), "ether")
      );
    });

    it("Should not harvest for epoch if in same epoch", async function () {
      await time.increaseTo(startTime);

      await expectRevert(
        this.yieldFarm.harvest(1, {
          from: user1
        }),
        "This epoch is in the future"
      );
    });

    it("Should not harvest for epoch if previous epoch not harvested", async function () {
      const epoch2 =
        Number(await time.latest()) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await expectRevert(
        this.yieldFarm.harvest(2, {
          from: user2
        }),
        "Harvest in order"
      );
    });

    it("Should not harvest for epoch if SLICE allowance is less than the reward", async function () {
      const epoch1 =
        Number(await time.latest()) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);
      await this.vault.setAllowance(
        this.yieldFarm.address,
        new BN(0).toString(),
        { from: owner }
      );

      await expectRevert(
        this.yieldFarm.harvest(1, {
          from: user2
        }),
        "ERC20: transfer amount exceeds allowance"
      );
    });
  });

  describe("massHarvest()", function () {
    beforeEach(async function () {
      await this.slice.transfer(
        this.vault.address,
        web3.utils.toWei((10000).toString(), "ether"),
        { from: owner }
      );

      await this.vault.setAllowance(
        this.yieldFarm.address,
        web3.utils.toWei((10000).toString(), "ether"),
        { from: owner }
      );

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        1,
        web3.utils.toWei((10).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        1,
        web3.utils.toWei((30).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user2,
        this.dai.address,
        2,
        web3.utils.toWei((20).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
    });

    it("Should massHarvest for user1 after epoch 1", async function () {
      const epoch1 =
        Number(currentTime) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await this.yieldFarm.massHarvest({ from: user1 });

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((250).toString(), "ether")
      );
    });

    it("Should massHarvest for user2 after epoch 1", async function () {
      const epoch1 =
        Number(currentTime) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await this.yieldFarm.massHarvest({ from: user2 });

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((750).toString(), "ether")
      );
    });

    it("Should massHarvest for user1 after epoch 2", async function () {
      const epoch2 =
        Number(currentTime) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await this.yieldFarm.massHarvest({ from: user1 });

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((1000).toString(), "ether")
      );
    });

    it("Should massHarvest for user2 after epoch 2", async function () {
      const epoch2 =
        Number(currentTime) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await this.yieldFarm.massHarvest({ from: user2 });

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((1000).toString(), "ether")
      );
    });

    it("Should not massHarvest for epoch if SLICE allowance is less than the reward", async function () {
      const epoch2 =
        Number(currentTime) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);
      await this.vault.setAllowance(
        this.yieldFarm.address,
        new BN(0).toString(),
        { from: owner }
      );

      await expectRevert(
        this.yieldFarm.massHarvest({
          from: user2
        }),
        "ERC20: transfer amount exceeds allowance"
      );
    });
  });

  describe("initEpoch()", function () {
    beforeEach(async function () {
      await this.staking.setEpochPoolSize(
        this.dai.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        3,
        web3.utils.toWei((100).toString(), "ether")
      );
    });

    it("Should initialize epoch1 to epoch5", async function () {
      const epoch =
        Number(currentTime) + Number(time.duration.minutes(10));
      await time.increaseTo(epoch);

      await this.yieldFarm.initEpoch(1, { from: user1 });

      await this.yieldFarm.initEpoch(2, { from: user2 });

      var reward = await this.yieldFarm.totalRewardInEpoch(2);
      expect(reward).to.be.bignumber.equal(epochRewardCap);

      await this.yieldFarm.initEpoch(3, { from: owner });

      reward = await this.yieldFarm.totalRewardInEpoch(3);
      expect(reward).to.be.bignumber.equal(epochRewardCap);

      await this.yieldFarm.initEpoch(4, { from: owner });

      reward = await this.yieldFarm.totalRewardInEpoch(4);
      expect(reward).to.be.bignumber.equal(epochRewardCap);

      reward = await this.yieldFarm.totalRewardInEpoch(5);
      expect(reward).to.be.bignumber.equal(new BN(0).toString());
      
      await this.yieldFarm.initEpoch(5, { from: owner });

      reward = await this.yieldFarm.totalRewardInEpoch(5);
      expect(reward).to.be.bignumber.equal(epochRewardCap);
    });

    it("Should not initialize epoch 2 before epoch 1", async function () {
      const epoch =
        Number(currentTime) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch);

      await expectRevert(
        this.yieldFarm.initEpoch(2, { from: user2 }),
        "Epoch can be init only in order"
      );
    });

    it("Should not initialize epoch which is ongoing or in the future", async function () {
      const epoch =
        Number(currentTime) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch);

      await expectRevert(
        this.yieldFarm.initEpoch(3, { from: user2 }),
        "This epoch is in the future"
      );

      await expectRevert(
        this.yieldFarm.initEpoch(5, { from: user2 }),
        "This epoch is in the future"
      );
    });
  });
});
