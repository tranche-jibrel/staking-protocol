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

  beforeEach(async function () {
    const currentTime = await time.latest();
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

    this.yieldFarm = await YieldFarm.new({
      from: owner
    });

    await this.yieldFarm.initialize(
      this.slice.address,
      this.staking.address,
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

      const totalReward = await this.yieldFarm.totalRewardInEpoch(1);
      expect(totalReward).to.be.bignumber.equal(epochRewardCap);
    });
  });

  describe("addStakableToken()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner,
      });

      await this.dai.initialize(10, "DAIToken", "DAI", {
        from: owner,
      });
    });

    it("Should add stakable token", async function () {
      await this.yieldFarm.addStakableToken(this.dai.address, 100, {
        from: owner,
      });

      const num = await this.yieldFarm.noOfStakableTokens();
      expect(num).to.be.bignumber.equal(new BN(1).toString());

      const tokenAddress = await this.yieldFarm.stakableToken(1);
      expect(tokenAddress).to.be.equal(this.dai.address);

      const weight = await this.yieldFarm.weightOfStakableToken(
        this.dai.address
      );
      expect(weight).to.be.bignumber.equal(new BN(100).toString());
    });

    it("Should not add stakable token if not called by owner", async function () {
      await expectRevert(
        this.yieldFarm.addStakableToken(this.dai.address, 100, {
          from: anotherAccount,
        }),
        "Ownable: caller is not the owner"
      );
    });

    it("Should not add stakable token if not called by owner", async function () {
      await this.yieldFarm.addStakableToken(this.dai.address, 100, {
        from: owner,
      });

      await expectRevert(
        this.yieldFarm.addStakableToken(this.dai.address, 100, {
          from: owner,
        }),
        "YieldFarm: Token already added"
      );
    });
  });

  describe("removeStakableToken()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      this.usdc = await Token.new({
        from: owner
      });

      this.usdt = await Token.new({
        from: owner
      });

      await this.dai.initialize(10, "DAIToken", "DAI", {
        from: owner
      });

      await this.yieldFarm.addStakableToken(this.dai.address, 100, {
        from: owner
      });
      await this.yieldFarm.addStakableToken(this.usdc.address, 200, {
        from: owner
      });
      await this.yieldFarm.addStakableToken(this.usdt.address, 300, {
        from: owner
      });
    });

    it("Should remove stakable token", async function () {
      await this.yieldFarm.removeStakableToken(this.dai.address, {
        from: owner
      });

      const num = await this.yieldFarm.noOfStakableTokens();
      expect(num).to.be.bignumber.equal(new BN(2).toString());

      const tokenAddress = await this.yieldFarm.stakableToken(1);
      expect(tokenAddress).to.be.equal(this.usdc.address);

      const tokenAddress2 = await this.yieldFarm.stakableToken(2);
      expect(tokenAddress2).to.be.equal(this.usdt.address);
    });

    it("Should not remove stakable token if not called by owner", async function () {
      await expectRevert(
        this.yieldFarm.removeStakableToken(this.dai.address, {
          from: anotherAccount,
        }),
        "Ownable: caller is not the owner"
      );
    });

    it("Should not add stakable token if not called by owner", async function () {
      await this.yieldFarm.removeStakableToken(this.dai.address, {
        from: owner
      });

      await expectRevert(
        this.yieldFarm.removeStakableToken(this.dai.address, {
          from: owner
        }),
        "YieldFarm: Token is not added"
      );
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
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000, "DAIToken", "DAI", {
        from: owner
      });

      this.usdc = await Token.new({
        from: owner
      });

      await this.usdc.initialize(1000, "USDCToken", "USDC", {
        from: owner
      });

      this.usdt = await Token.new({
        from: owner
      });

      await this.usdt.initialize(1000, "USDTToken", "USDT", {
        from: owner
      });

      await this.yieldFarm.addStakableToken(this.dai.address, 100, {
        from: owner
      });
      await this.yieldFarm.addStakableToken(this.usdc.address, 200, {
        from: owner
      });
      await this.yieldFarm.addStakableToken(this.usdt.address, 300, {
        from: owner
      });

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
        user1,
        this.usdc.address,
        1,
        web3.utils.toWei((10).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user1,
        this.usdt.address,
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
        this.usdc.address,
        1,
        web3.utils.toWei((30).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user2,
        this.usdt.address,
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
        user2,
        this.usdc.address,
        2,
        web3.utils.toWei((20).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user2,
        this.usdt.address,
        2,
        web3.utils.toWei((20).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user1,
        this.usdc.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user1,
        this.usdt.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdc.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdt.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdc.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdt.address,
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
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000, "DAIToken", "DAI", {
        from: owner
      });

      this.usdc = await Token.new({
        from: owner
      });

      await this.usdc.initialize(1000, "USDCToken", "USDC", {
        from: owner
      });

      this.usdt = await Token.new({
        from: owner
      });

      await this.usdt.initialize(1000, "USDTToken", "USDT", {
        from: owner
      });

      await this.yieldFarm.addStakableToken(this.dai.address, 100, {
        from: owner
      });
      await this.yieldFarm.addStakableToken(this.usdc.address, 200, {
        from: owner
      });
      await this.yieldFarm.addStakableToken(this.usdt.address, 300, {
        from: owner
      });

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
        user1,
        this.usdc.address,
        1,
        web3.utils.toWei((10).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user1,
        this.usdt.address,
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
        this.usdc.address,
        1,
        web3.utils.toWei((30).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user2,
        this.usdt.address,
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
        user2,
        this.usdc.address,
        2,
        web3.utils.toWei((20).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user2,
        this.usdt.address,
        2,
        web3.utils.toWei((20).toString(), "ether")
      );

      await this.staking.setEpochUserBalance(
        user1,
        this.dai.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user1,
        this.usdc.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );
      await this.staking.setEpochUserBalance(
        user1,
        this.usdt.address,
        2,
        web3.utils.toWei((60).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdc.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdt.address,
        1,
        web3.utils.toWei((40).toString(), "ether")
      );

      await this.staking.setEpochPoolSize(
        this.dai.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdc.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
      await this.staking.setEpochPoolSize(
        this.usdt.address,
        2,
        web3.utils.toWei((80).toString(), "ether")
      );
    });

    it("Should massHarvest for user1 after epoch 1", async function () {
      const epoch1 =
        Number(await time.latest()) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await this.yieldFarm.massHarvest(user1, { from: user1 });

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((250).toString(), "ether")
      );
    });

    it("Should massHarvest for user2 after epoch 1", async function () {
      const epoch1 =
        Number(await time.latest()) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await this.yieldFarm.massHarvest(user2, { from: user2 });

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((750).toString(), "ether")
      );
    });

    it("Should massHarvest for user1 after epoch 2", async function () {
      const epoch2 =
        Number(await time.latest()) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await this.yieldFarm.massHarvest(user1, { from: user1 });

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((1000).toString(), "ether")
      );
    });

    it("Should massHarvest for user2 after epoch 2", async function () {
      const epoch2 =
        Number(await time.latest()) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);

      await this.yieldFarm.massHarvest(user2, { from: user2 });

      const reward = await this.slice.balanceOf(user2);
      expect(reward).to.be.bignumber.equal(
        web3.utils.toWei((1000).toString(), "ether")
      );
    });

    it("Should not massHarvest for user1 if not called by user1", async function () {
      const epoch1 =
        Number(await time.latest()) + Number(time.duration.minutes(6));
      await time.increaseTo(epoch1);

      await expectRevert(
        this.yieldFarm.massHarvest(user1, {
          from: user2
        }),
        "YieldFarm: Not eligible for the harvest"
      );
    });

    it("Should not massHarvest for epoch if SLICE allowance is less than the reward", async function () {
      const epoch2 =
        Number(await time.latest()) + Number(time.duration.minutes(7));
      await time.increaseTo(epoch2);
      await this.vault.setAllowance(
        this.yieldFarm.address,
        new BN(0).toString(),
        { from: owner }
      );

      await expectRevert(
        this.yieldFarm.massHarvest(user2, {
          from: user2
        }),
        "ERC20: transfer amount exceeds allowance"
      );
    });
  });
});
