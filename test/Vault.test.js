const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { expect } = require("chai");
const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");

const Vault = contract.fromArtifact("Vault");
const Token = contract.fromArtifact("MyERC20");

const BigNumber = web3.utils.BN;
require("chai").use(require("chai-bn")(BigNumber)).should();

describe("Vault", function () {
  const [owner, anotherAccount, user1] = accounts;

  beforeEach(async function () {
    this.slice = await Token.new({
      from: owner
    });

    await this.slice.initialize(100, "Jibrel Token", "SLICE", {
      from: owner
    });

    this.vault = await Vault.new(this.slice.address, { from: owner });

    await this.slice.transfer(
      this.vault.address,
      web3.utils.toWei((100).toString(), "ether"),
      { from: owner }
    );
  });

  describe("initialize()", function () {
    it("Should initialize properly", async function () {
      const sliceAddress = await this.vault.SLICE();
      expect(sliceAddress).to.be.equal(this.slice.address);
    });
  });

  describe("setAllowance()", function () {
    it("Should set allowance", async function () {
      await this.vault.setAllowance(user1, 100, { from: owner });

      const allowance = await this.slice.allowance(this.vault.address, user1);
      expect(allowance).to.be.bignumber.equal(new BN(100).toString());
    });

    it("Should not set allowance if not called by owner", async function () {
      await expectRevert(
        this.vault.setAllowance(user1, 100, {
          from: anotherAccount
        }),
        "Ownable: caller is not the owner"
      );
    });
  });
});
