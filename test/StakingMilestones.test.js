const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time
} = require("@openzeppelin/test-helpers");

const StakingMilestones = contract.fromArtifact("StakingMilestones");
const Vault = contract.fromArtifact("Vault");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("StakingMilestones", function () {
  const [owner, anotherAccount, user1] = accounts;

  const epochRewardCap = web3.utils.toWei((1000).toString(), "ether");
  var startTime;
  var currentTime;

  beforeEach(async function () {
    currentTime = await time.latest();
    startTime = Number(currentTime) + Number(time.duration.minutes(7));

    this.slice = await Token.new({
      from: owner
    });

    await this.slice.initialize(1000000000, "Jibrel Token", "SLICE", {
      from: owner
    });

    this.staking = await StakingMilestones.new({
      from: owner
    });

    await this.staking.initialize(startTime, 60, {
      from: owner
    });

    this.vault = await Vault.new(this.slice.address, { from: owner });

    await this.slice.transfer(
      this.vault.address,
      web3.utils.toWei((10000).toString(), "ether"),
      { from: owner }
    );
  });

  describe("initialize()", function () {
    it("Should initialize properly", async function () {
      const epochStart = await this.staking.epoch1Start();
      expect(epochStart).to.be.bignumber.equal(startTime.toString());

      const duration = await this.staking.epochDuration();
      expect(duration).to.be.bignumber.equal(new BN(60).toString());
    });
  });

  describe("deposit()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      await this.dai.transfer(user1, web3.utils.toWei((10000).toString(), "ether"), { from: owner });
    });

    it("Should deposit", async function () {
      await this.dai.approve(this.staking.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      await this.staking.manualEpochInit([this.dai.address], 0, { from: owner });

      await time.increaseTo(startTime);

      await this.staking.deposit(this.dai.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      const balance = await this.staking.getEpochUserBalance(user1, this.dai.address, 1);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));

      const poolSize = await this.staking.getEpochPoolSize(this.dai.address, 1);
      expect(poolSize).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));

      const isEpochInitialized = await this.staking.epochIsInitialized(this.dai.address, 1);
      expect(isEpochInitialized).to.be.equal(true);
    });

    it("Should deposit with correct user balance", async function () {
      await this.dai.approve(this.staking.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      await this.staking.manualEpochInit([this.dai.address], 0, { from: owner });

      const desiredTime = Number(currentTime) + Number(time.duration.seconds(450));

      await time.increaseTo(desiredTime);

      await this.staking.deposit(this.dai.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      const balance = await this.staking.getEpochUserBalance(user1, this.dai.address, 1);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((50).toString(), "ether"));
    });

    it("Should deposit before start time and after", async function () {
      await this.dai.approve(this.staking.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      await this.staking.deposit(this.dai.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });

      await time.increaseTo(startTime);

      await this.staking.deposit(this.dai.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });
    });

    it("Should not deposit if previous epoch not initialized", async function () {
      await this.dai.approve(this.staking.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      await time.increaseTo(startTime);

      await expectRevert(
        this.staking.deposit(
          this.dai.address,
          web3.utils.toWei((100).toString(), "ether"),
          {
            from: user1
          }
        ),
        "Staking: previous epoch not initialized"
      );
    });

    it("Should not deposit if amount is 0", async function () {
      await expectRevert(
        this.staking.deposit(
          this.dai.address,
          0,
          {
            from: user1
          }
        ),
        "Staking: Amount must be > 0"
      );
    });

    it("Should not deposit if allowance is less than amount entered", async function () {
      await expectRevert(
        this.staking.deposit(
          this.dai.address,
          web3.utils.toWei((100).toString(), "ether"),
          {
            from: user1
          }
        ),
        "Staking: Token allowance too low"
      );
    });
  });

  describe("withdraw()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      await this.dai.transfer(user1, web3.utils.toWei((10000).toString(), "ether"), { from: owner });

      await this.dai.approve(this.staking.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      await this.staking.deposit(this.dai.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });
    });

    it("Should withdraw", async function () {
      var balance = await this.staking.balanceOf(user1, this.dai.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));

      const desiredTime = Number(currentTime) + Number(time.duration.minutes(8));

      await time.increaseTo(desiredTime);

      await this.staking.manualEpochInit([this.dai.address], 2, { from: user1 });

      await this.staking.withdraw(this.dai.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });

      balance = await this.staking.balanceOf(user1, this.dai.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((90).toString(), "ether"));
    });

    it("Should withdraw multiple times", async function () {
      var balance = await this.staking.balanceOf(user1, this.dai.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));

      const desiredTime = Number(currentTime) + Number(time.duration.minutes(7));
      
      await time.increaseTo(desiredTime);

      await this.staking.withdraw(this.dai.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });
      await this.staking.withdraw(this.dai.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });
      await this.staking.withdraw(this.dai.address, web3.utils.toWei((10).toString(), "ether"), { from: user1 });

      balance = await this.staking.balanceOf(user1, this.dai.address);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((70).toString(), "ether"));
    });

    it("Should not withdraw if balance is less than amount entered", async function () {
      await time.increaseTo(startTime);

      await expectRevert(
        this.staking.withdraw(
          this.dai.address,
          web3.utils.toWei((101).toString(), "ether"),
          {
            from: user1
          }
        ),
        "Staking: balance too small"
      );
    });
  });

  describe("manualEpochInit()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });
    });

    it("Should initialize epoch", async function () {
      await time.increaseTo(startTime);

      await this.staking.manualEpochInit([this.dai.address], 0, { from: user1 });
      await this.staking.manualEpochInit([this.dai.address], 1, { from: user1 });

      var isEpochInitialized = await this.staking.epochIsInitialized(this.dai.address, 0);
      expect(isEpochInitialized).to.be.equal(true);

      isEpochInitialized = await this.staking.epochIsInitialized(this.dai.address, 1);
      expect(isEpochInitialized).to.be.equal(true);
    });

    it("Should not initialize epoch if epoch id is greater than current epoch id", async function () {
      await expectRevert(
        this.staking.manualEpochInit(
          [this.dai.address],
          1,
          {
            from: user1
          }
        ),
        "can't init a future epoch"
      );
    });

    it("Should not initialize epoch twice", async function () {
      await time.increaseTo(startTime);

      await this.staking.manualEpochInit([this.dai.address], 0, { from: user1 });
      await this.staking.manualEpochInit([this.dai.address], 1, { from: user1 });

      await expectRevert(
        this.staking.manualEpochInit(
          [this.dai.address],
          1,
          {
            from: user1
          }
        ),
        "Staking: epoch already initialized"
      );
    });

    it("Should not initialize epoch if previous epoch is not initialized", async function () {
      await time.increaseTo(startTime);

      await expectRevert(
        this.staking.manualEpochInit(
          [this.dai.address],
          1,
          {
            from: user1
          }
        ),
        "Staking: previous epoch not initialized"
      );
    });
  });

  describe("emergencyWithdraw()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      await this.dai.transfer(user1, web3.utils.toWei((10000).toString(), "ether"), { from: owner });

      await this.dai.approve(this.staking.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });

      await this.staking.deposit(this.dai.address, web3.utils.toWei((100).toString(), "ether"), { from: user1 });
    });

    it("Should withdraw in emergency", async function () {
      const desiredTime = Number(startTime) + Number(time.duration.minutes(10));
      await time.increaseTo(desiredTime);

      await this.staking.emergencyWithdraw(this.dai.address, { from: user1 });

      var balance = await this.dai.balanceOf(user1);
      expect(balance).to.be.bignumber.equal(web3.utils.toWei((10000).toString(), "ether"));
    });

    it("Should not withdraw in emergency if 10 epochs haven't passed without withdrawing", async function () {
      const desiredTime = Number(startTime) + Number(time.duration.minutes(8));
      await time.increaseTo(desiredTime);

      await expectRevert(
        this.staking.emergencyWithdraw(
          this.dai.address,
          {
            from: user1
          }
        ),
        "At least 10 epochs must pass without success"
      );
    });

    it("Should not withdraw in emergency if token balance is 0", async function () {
      const desiredTime = Number(startTime) + Number(time.duration.minutes(10));
      await time.increaseTo(desiredTime);

      this.usdc = await Token.new({
        from: owner
      });

      await expectRevert(
        this.staking.emergencyWithdraw(
          this.usdc.address,
          {
            from: user1
          }
        ),
        "Amount must be > 0"
      );
    });
  });
});
