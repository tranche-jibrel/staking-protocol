const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  time,
} = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = constants;

const Staking = contract.fromArtifact("Staking");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("Staking", function () {
  const [owner, anotherAccount, user1, user2] = accounts;

  const rewardCap = web3.utils.toWei((10).toString(), "ether");
  var startTime;

  beforeEach(async function () {
    const currentTime = await time.latest();
    startTime = Number(currentTime) + Number(time.duration.minutes(10));

    this.slice = await Token.new({
      from: owner
    });

    await this.slice.initialize(1000000000, "Jibrel Token", "SLICE", {
      from: owner
    });

    this.staking = await Staking.new(
      startTime,
      rewardCap,
      5,
      this.slice.address,
      {
        from: owner
      }
    );
  });

  describe("initialize()", function () {
    it("Should initialize properly", async function () {
      const result = await this.staking.startTime();
      expect(result).to.be.bignumber.equal(startTime.toString());

      const cap = await this.staking.rewardCap();
      expect(cap).to.be.bignumber.equal(rewardCap);

      const buffer = await this.staking.withdrawBuffer();
      expect(buffer).to.be.bignumber.equal(new BN(5).toString());

      const tokenAddress = await this.staking.SLICE();
      expect(tokenAddress).to.be.equal(this.slice.address);
    });
  });

  describe("addStakableToken()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });
    });

    it("Should add stakable token", async function () {
      const tx = await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((0.1).toString(), "ether"),
        { from: owner }
      );

      const result = await this.staking.isWhitelisted(this.dai.address);
      expect(result).to.be.equal(true);

      const rpb = await this.staking.rewardPerBlock(this.dai.address);
      expect(rpb).to.be.bignumber.equal(
        web3.utils.toWei((0.1).toString(), "ether")
      );

      expectEvent(tx, "TokenAddedToWhitelist", {
        newTokenAddress: this.dai.address,
        rewardPerBlock: web3.utils.toWei((0.1).toString(), "ether"),
      });
    });

    it("Should not add stakable token if not called by owner", async function () {
      await expectRevert(
        this.staking.addStakableToken(this.dai.address, 100, {
          from: anotherAccount
        }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("removeStakableToken()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((0.1).toString(), "ether"),
        { from: owner }
      );
    });

    it("Should remove stakable token", async function () {
      const tx = await this.staking.removeStakableToken(this.dai.address, {
        from: owner
      });

      const result = await this.staking.isWhitelisted(this.dai.address);
      expect(result).to.be.equal(false);

      const rpb = await this.staking.rewardPerBlock(this.dai.address);
      expect(rpb).to.be.bignumber.equal(new BN(0).toString());

      expectEvent(tx, "TokenRemovedFromWhitelist", {
        tokenAddress: this.dai.address
      });
    });

    it("Should not remove stakable token if not called by owner", async function () {
      await expectRevert(
        this.staking.removeStakableToken(this.dai.address, {
          from: anotherAccount
        }),
        "Ownable: caller is not the owner"
      );
    });

    it("Should not remove stakable token if token is not whitelisted", async function () {
      await this.staking.removeStakableToken(this.dai.address, { from: owner });

      await expectRevert(
        this.staking.removeStakableToken(this.dai.address, { from: owner }),
        "Staking: Token not whitelisted"
      );
    });
  });

  describe("updateSLICEAddress()", function () {
    beforeEach(async function () {
      this.token = await Token.new(1000000000, "Jibrel Token", "NewSLICE", {
        from: owner
      });
    });

    it("Should update SLICE token address", async function () {
      var tokenAddress = await this.staking.SLICE();
      expect(tokenAddress).to.be.equal(this.slice.address);

      const tx = await this.staking.updateSLICEAddress(this.token.address, {
        from: owner
      });

      tokenAddress = await this.staking.SLICE();
      expect(tokenAddress).to.be.equal(this.token.address);

      expectEvent(tx, "SLICEAddressUpdated", {
        tokenAddress: this.token.address
      });
    });

    it("Should not update SLICE token address if not called by owner", async function () {
      await expectRevert(
        this.staking.updateSLICEAddress(this.token.address, {
          from: anotherAccount
        }),
        "Ownable: caller is not the owner"
      );

      var tokenAddress = await this.staking.SLICE();
      expect(tokenAddress).to.be.equal(this.slice.address);
    });
  });

  describe("updateRewardCap()", function () {
    it("Should update reward cap", async function () {
      var cap = await this.staking.rewardCap();
      expect(cap).to.be.bignumber.equal(rewardCap);

      const tx = await this.staking.updateRewardCap(10, { from: owner });

      cap = await this.staking.rewardCap();
      expect(cap).to.be.bignumber.equal(new BN(10).toString());

      expectEvent(tx, "RewardCapUpdated", {
        newRewardCap: new BN(10).toString(),
      });
    });

    it("Should not update reward cap if not called by owner", async function () {
      await expectRevert(
        this.staking.updateRewardCap(10, { from: anotherAccount }),
        "Ownable: caller is not the owner"
      );

      var cap = await this.staking.rewardCap();
      expect(cap).to.be.bignumber.equal(rewardCap);
    });
  });

  describe("updateWithdrawBuffer()", function () {
    it("Should update withdraw buffer", async function () {
      var buffer = await this.staking.withdrawBuffer();
      expect(buffer).to.be.bignumber.equal(new BN(5).toString());

      const tx = await this.staking.updateWithdrawBuffer(20, { from: owner });

      buffer = await this.staking.withdrawBuffer();
      expect(buffer).to.be.bignumber.equal(new BN(20).toString());

      expectEvent(tx, "WithdrawBufferUpdated", {
        newWithdrawBuffer: new BN(20).toString()
      });
    });

    it("Should not update withdraw buffer if not called by owner", async function () {
      await expectRevert(
        this.staking.updateWithdrawBuffer(20, { from: anotherAccount }),
        "Ownable: caller is not the owner"
      );

      var buffer = await this.staking.withdrawBuffer();
      expect(buffer).to.be.bignumber.equal(new BN(5).toString());
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

      await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: owner }
      );

      await this.dai.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );
    });

    it("Should deposit", async function () {
      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await time.increaseTo(startTime);

      const tx = await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      expectEvent(tx, "Deposit", {
        user: user1,
        tokenAddress: this.dai.address,
        stakedAmount: web3.utils.toWei((10).toString(), "ether"),
        accruedRewards: new BN(0).toString()
      });
    });

    it("Should not deposit if token is not whitelisted", async function () {
      await time.increaseTo(startTime);

      this.token = await Token.new({
        from: owner
      });

      await expectRevert(
        this.staking.deposit(
          this.token.address,
          web3.utils.toWei((10).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: Token not whitelisted"
      );
    });

    it("Should not deposit if rewards distributed have reached the reward cap", async function () {
      await time.increaseTo(startTime);

      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );

      await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      var block = await time.latestBlock();

      var targetBlock = Number(block) + 10;

      await time.advanceBlockTo(targetBlock);

      await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: user1 }
      );

      var rewardsDistributed = await this.staking.rewardsDistributed();

      expect(rewardsDistributed).to.be.bignumber.equal(
        web3.utils.toWei((10).toString(), "ether")
      );

      await expectRevert(
        this.staking.deposit(
          this.dai.address,
          web3.utils.toWei((10).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: Rewards have already been distributed :("
      );
    });

    it("Should not deposit if staking time hasn't started", async function () {
      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await expectRevert(
        this.staking.deposit(
          this.dai.address,
          web3.utils.toWei((10).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: Staking period hasn't started yet!"
      );
    });

    it("Should not deposit if staking amount entered is 0", async function () {
      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await time.increaseTo(startTime);

      await expectRevert(
        this.staking.deposit(this.dai.address, 0, { from: user1 }),
        "Staking: Amount must be > 0"
      );
    });

    it("Should not deposit if not approved by the depositor", async function () {
      await time.increaseTo(startTime);

      await expectRevert(
        this.staking.deposit(
          this.dai.address,
          web3.utils.toWei((10).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: Token allowance too low"
      );
    });
  });

  describe("withdraw()", function () {
    var block;
    var targetBlock;
  
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: owner }
      );

      await this.dai.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );

      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await time.increaseTo(startTime);

      const tx = await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      block = await time.latestBlock();

      targetBlock = Number(block) + 5;
    });

    it("Should withdraw", async function () {
      await this.slice.transfer(
        this.staking.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: owner }
      );

      await time.advanceBlockTo(targetBlock);

      const tx = await this.staking.withdraw(
        this.dai.address,
        web3.utils.toWei((5).toString(), "ether"),
        { from: user1 }
      );

      const reward = await this.slice.balanceOf(user1);
      expect(reward).to.be.bignumber.equal(web3.utils.toWei((60).toString(), "ether"));

      expectEvent(tx, "Withdraw", {
        user: user1,
        tokenAddress: this.dai.address,
        amount: web3.utils.toWei((5).toString(), "ether"),
        reward: web3.utils.toWei((60).toString(), "ether")
      });
    });

    it("Should not withdraw if token is not whitelisted", async function () {
      this.token = await Token.new({
        from: owner
      });

      await expectRevert(
        this.staking.withdraw(
          this.token.address,
          web3.utils.toWei((10).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: Token not whitelisted"
      );
    });

    it("Should not withdraw if withdraw buffer is not met", async function () {
      await expectRevert(
        this.staking.withdraw(
          this.dai.address,
          web3.utils.toWei((10).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: Withdraw buffer not met!"
      );
    });

    it("Should not withdraw if staking balance is low", async function () {
      await time.advanceBlockTo(targetBlock);

      await expectRevert(
        this.staking.withdraw(
          this.dai.address,
          web3.utils.toWei((11).toString(), "ether"),
          { from: user1 }
        ),
        "Staking: balance too low"
      );
    });

    it("Should not withdraw if staking contract does not have enough rewards", async function () {
      await time.advanceBlockTo(targetBlock);

      await expectRevert(
        this.staking.withdraw(
          this.dai.address,
          web3.utils.toWei((5).toString(), "ether"),
          { from: user1 }
        ),
        "SafeERC20: low-level call failed"
      );
    });
  });

  describe("getTotalReward()", function () {
    var block;
    var targetBlock;
  
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: owner }
      );

      await this.dai.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );

      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await time.increaseTo(startTime);

      const tx = await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      block = await time.latestBlock();

      targetBlock = Number(block) + 5;
    });

    it("Should return total reward", async function () {
      await time.advanceBlockTo(targetBlock);

      const reward = await this.staking.getTotalReward(
        this.dai.address,
        { from: user1 }
      );

      expect(reward).to.be.bignumber.equal(web3.utils.toWei((50).toString(), "ether"));
    });

    it("Should increment total reward with every passing block", async function () {
      await time.advanceBlockTo((targetBlock) + 1);

      const reward = await this.staking.getTotalReward(
        this.dai.address,
        { from: user1 }
      );

      expect(reward).to.be.bignumber.equal(web3.utils.toWei((60).toString(), "ether"));
    });
  });

  describe("balanceOf()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      this.usdc = await Token.new({
        from: owner
      });

      await this.usdc.initialize(1000000000, "US Dollar", "USDC", {
        from: owner
      });

      await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: owner }
      );

      await this.staking.addStakableToken(
        this.usdc.address,
        web3.utils.toWei((2).toString(), "ether"),
        { from: owner }
      );

      await this.dai.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );

      await this.usdc.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );

      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );

      await this.usdc.approve(
        this.staking.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );

      await time.increaseTo(startTime);

      await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await this.staking.deposit(
        this.usdc.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );
    });

    it("Should return staked balance", async function () {
      const balance = await this.staking.balanceOf(
        user1,
        this.dai.address,
        { from: user1 }
      );

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      const balance1 = await this.staking.balanceOf(
        user1,
        this.usdc.address,
        { from: user1 }
      );

      expect(balance1).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));
    });

    it("Should update staked balance", async function () {
      await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: user1 }
      );

      const balance = await this.staking.balanceOf(
        user1,
        this.dai.address,
        { from: user1 }
      );

      expect(balance).to.be.bignumber.equal(web3.utils.toWei((11).toString(), "ether"));
    });
  });

  describe("getPoolSize()", function () {
    beforeEach(async function () {
      this.dai = await Token.new({
        from: owner
      });

      await this.dai.initialize(1000000000, "DAIToken", "DAI", {
        from: owner
      });

      this.usdc = await Token.new({
        from: owner
      });

      await this.usdc.initialize(1000000000, "US Dollar", "USDC", {
        from: owner
      });

      await this.staking.addStakableToken(
        this.dai.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: owner }
      );

      await this.staking.addStakableToken(
        this.usdc.address,
        web3.utils.toWei((0.1).toString(), "ether"),
        { from: owner }
      );

      await this.dai.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );

      await this.usdc.transfer(
        user1,
        web3.utils.toWei((1000).toString(), "ether"),
        { from: owner }
      );

      await this.dai.approve(
        this.staking.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );

      await this.usdc.approve(
        this.staking.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );

      await time.increaseTo(startTime);

      await this.staking.deposit(
        this.dai.address,
        web3.utils.toWei((10).toString(), "ether"),
        { from: user1 }
      );

      await this.staking.deposit(
        this.usdc.address,
        web3.utils.toWei((100).toString(), "ether"),
        { from: user1 }
      );
    });

    it("Should return token pool size", async function () {
      const poolSize = await this.staking.getPoolSize(
        this.dai.address,
        { from: user1 }
      );

      expect(poolSize).to.be.bignumber.equal(web3.utils.toWei((10).toString(), "ether"));

      const poolSize1 = await this.staking.getPoolSize(
        this.usdc.address,
        { from: user1 }
      );

      expect(poolSize1).to.be.bignumber.equal(web3.utils.toWei((100).toString(), "ether"));
    });

    it("Should update pool size", async function () {
      await this.usdc.transfer(
        user2,
        web3.utils.toWei((10).toString(), "ether"),
        { from: owner }
      );

      await this.usdc.approve(
        this.staking.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: user2 }
      );

      await this.staking.deposit(
        this.usdc.address,
        web3.utils.toWei((1).toString(), "ether"),
        { from: user2 }
      );

      const poolSize = await this.staking.getPoolSize(
        this.usdc.address,
        { from: user1 }
      );

      expect(poolSize).to.be.bignumber.equal(web3.utils.toWei((101).toString(), "ether"));
    });
  });
});
