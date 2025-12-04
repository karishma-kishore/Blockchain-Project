const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SDCToken", function () {
  let sdcToken;
  let owner, minter, user1, user2, user3;
  const INITIAL_SUPPLY = 1000000; // 1 million tokens
  const MAX_SUPPLY = 10000000;    // 10 million tokens

  beforeEach(async function () {
    [owner, minter, user1, user2, user3] = await ethers.getSigners();

    const SDCToken = await ethers.getContractFactory("SDCToken");
    sdcToken = await SDCToken.deploy(
      owner.address,
      minter.address,
      INITIAL_SUPPLY,
      MAX_SUPPLY
    );
    await sdcToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await sdcToken.name()).to.equal("SunDevilSync Coin");
      expect(await sdcToken.symbol()).to.equal("SDC");
    });

    it("Should set correct decimals", async function () {
      expect(await sdcToken.decimals()).to.equal(18);
    });

    it("Should mint initial supply to admin", async function () {
      const expectedSupply = ethers.parseEther(INITIAL_SUPPLY.toString());
      expect(await sdcToken.balanceOf(owner.address)).to.equal(expectedSupply);
      expect(await sdcToken.totalSupply()).to.equal(expectedSupply);
    });

    it("Should set max supply correctly", async function () {
      const expectedMaxSupply = ethers.parseEther(MAX_SUPPLY.toString());
      expect(await sdcToken.maxSupply()).to.equal(expectedMaxSupply);
    });

    it("Should grant admin role to owner", async function () {
      const adminRole = await sdcToken.DEFAULT_ADMIN_ROLE();
      expect(await sdcToken.hasRole(adminRole, owner.address)).to.be.true;
    });

    it("Should grant minter role to both owner and minter", async function () {
      const minterRole = await sdcToken.MINTER_ROLE();
      expect(await sdcToken.hasRole(minterRole, owner.address)).to.be.true;
      expect(await sdcToken.hasRole(minterRole, minter.address)).to.be.true;
    });

    it("Should grant pauser role to owner", async function () {
      const pauserRole = await sdcToken.PAUSER_ROLE();
      expect(await sdcToken.hasRole(pauserRole, owner.address)).to.be.true;
    });

    it("Should deploy with zero initial supply", async function () {
      const SDCToken = await ethers.getContractFactory("SDCToken");
      const token = await SDCToken.deploy(owner.address, minter.address, 0, 0);
      await token.waitForDeployment();

      expect(await token.totalSupply()).to.equal(0);
      expect(await token.maxSupply()).to.equal(0);
    });

    it("Should reject zero admin address", async function () {
      const SDCToken = await ethers.getContractFactory("SDCToken");
      await expect(
        SDCToken.deploy(ethers.ZeroAddress, minter.address, 0, 0)
      ).to.be.revertedWith("Invalid admin address");
    });
  });

  describe("Minting", function () {
    it("Should mint tokens to user", async function () {
      const amount = ethers.parseEther("100");

      await expect(sdcToken.connect(minter).mint(user1.address, amount, "Test mint"))
        .to.emit(sdcToken, "TokensMinted");

      expect(await sdcToken.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should update totalMinted after minting", async function () {
      const initialMinted = await sdcToken.totalMinted();
      const amount = ethers.parseEther("100");

      await sdcToken.connect(minter).mint(user1.address, amount, "Test mint");

      expect(await sdcToken.totalMinted()).to.equal(initialMinted + amount);
    });

    it("Should reject minting from non-minter", async function () {
      const amount = ethers.parseEther("100");

      await expect(
        sdcToken.connect(user1).mint(user1.address, amount, "Test mint")
      ).to.be.reverted;
    });

    it("Should reject minting to zero address", async function () {
      const amount = ethers.parseEther("100");

      await expect(
        sdcToken.connect(minter).mint(ethers.ZeroAddress, amount, "Test mint")
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should reject minting zero amount", async function () {
      await expect(
        sdcToken.connect(minter).mint(user1.address, 0, "Test mint")
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should reject minting beyond max supply", async function () {
      const remaining = await sdcToken.remainingMintable();
      const excessAmount = remaining + ethers.parseEther("1");

      await expect(
        sdcToken.connect(minter).mint(user1.address, excessAmount, "Test mint")
      ).to.be.revertedWith("Would exceed max supply");
    });
  });

  describe("Reward Distribution", function () {
    const eventId = ethers.id("event_hackathon_2025");

    it("Should distribute rewards to user", async function () {
      const amount = ethers.parseEther("10");

      await expect(
        sdcToken.connect(minter).distributeReward(user1.address, amount, "RSVP", eventId)
      )
        .to.emit(sdcToken, "RewardDistributed");

      expect(await sdcToken.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should update user reward statistics", async function () {
      const amount = ethers.parseEther("10");

      await sdcToken.connect(minter).distributeReward(user1.address, amount, "RSVP", eventId);
      await sdcToken.connect(minter).distributeReward(user1.address, amount, "ATTENDANCE", eventId);

      const stats = await sdcToken.getUserStats(user1.address);
      expect(stats.balance).to.equal(amount * 2n);
      expect(stats.rewards).to.equal(amount * 2n);
      expect(stats.count).to.equal(2);
    });

    it("Should batch distribute rewards", async function () {
      const recipients = [user1.address, user2.address, user3.address];
      const amounts = [
        ethers.parseEther("10"),
        ethers.parseEther("20"),
        ethers.parseEther("15")
      ];

      await sdcToken.connect(minter).batchDistributeReward(
        recipients,
        amounts,
        "ATTENDANCE",
        eventId
      );

      expect(await sdcToken.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await sdcToken.balanceOf(user2.address)).to.equal(amounts[1]);
      expect(await sdcToken.balanceOf(user3.address)).to.equal(amounts[2]);
    });

    it("Should reject batch with mismatched arrays", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("10")];

      await expect(
        sdcToken.connect(minter).batchDistributeReward(
          recipients,
          amounts,
          "ATTENDANCE",
          eventId
        )
      ).to.be.revertedWith("Arrays length mismatch");
    });

    it("Should reject batch with empty arrays", async function () {
      await expect(
        sdcToken.connect(minter).batchDistributeReward([], [], "ATTENDANCE", eventId)
      ).to.be.revertedWith("Empty arrays");
    });

    it("Should reject batch larger than 100", async function () {
      const recipients = Array(101).fill(user1.address);
      const amounts = Array(101).fill(ethers.parseEther("1"));

      await expect(
        sdcToken.connect(minter).batchDistributeReward(
          recipients,
          amounts,
          "ATTENDANCE",
          eventId
        )
      ).to.be.revertedWith("Batch too large");
    });
  });

  describe("Token Transfers", function () {
    beforeEach(async function () {
      // Transfer some tokens to user1 for testing
      await sdcToken.connect(owner).transfer(user1.address, ethers.parseEther("100"));
    });

    it("Should transfer tokens between users", async function () {
      const amount = ethers.parseEther("50");

      await sdcToken.connect(user1).transfer(user2.address, amount);

      expect(await sdcToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
      expect(await sdcToken.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should approve and transferFrom", async function () {
      const amount = ethers.parseEther("50");

      await sdcToken.connect(user1).approve(user2.address, amount);
      await sdcToken.connect(user2).transferFrom(user1.address, user3.address, amount);

      expect(await sdcToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
      expect(await sdcToken.balanceOf(user3.address)).to.equal(amount);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await sdcToken.connect(owner).transfer(user1.address, ethers.parseEther("100"));
    });

    it("Should burn tokens", async function () {
      const amount = ethers.parseEther("50");

      await expect(sdcToken.connect(user1).burn(amount))
        .to.emit(sdcToken, "TokensBurned");

      expect(await sdcToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should update totalBurned", async function () {
      const amount = ethers.parseEther("50");

      await sdcToken.connect(user1).burn(amount);

      expect(await sdcToken.totalBurned()).to.equal(amount);
    });

    it("Should burnFrom with approval", async function () {
      const amount = ethers.parseEther("50");

      await sdcToken.connect(user1).approve(user2.address, amount);
      await sdcToken.connect(user2).burnFrom(user1.address, amount);

      expect(await sdcToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
      expect(await sdcToken.totalBurned()).to.equal(amount);
    });
  });

  describe("Pausability", function () {
    it("Should pause and unpause", async function () {
      await sdcToken.connect(owner).pause();
      expect(await sdcToken.paused()).to.be.true;

      await sdcToken.connect(owner).unpause();
      expect(await sdcToken.paused()).to.be.false;
    });

    it("Should reject transfers when paused", async function () {
      await sdcToken.connect(owner).pause();

      await expect(
        sdcToken.connect(owner).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should reject minting when paused", async function () {
      await sdcToken.connect(owner).pause();

      await expect(
        sdcToken.connect(minter).mint(user1.address, ethers.parseEther("100"), "Test")
      ).to.be.reverted;
    });

    it("Should reject pause from non-pauser", async function () {
      await expect(sdcToken.connect(user1).pause()).to.be.reverted;
    });
  });

  describe("Max Supply Management", function () {
    it("Should update max supply", async function () {
      const newMaxSupply = 20000000;
      const expectedNewMax = ethers.parseEther(newMaxSupply.toString());

      await expect(sdcToken.connect(owner).setMaxSupply(newMaxSupply))
        .to.emit(sdcToken, "MaxSupplyUpdated");

      expect(await sdcToken.maxSupply()).to.equal(expectedNewMax);
    });

    it("Should set unlimited supply", async function () {
      await sdcToken.connect(owner).setMaxSupply(0);
      expect(await sdcToken.maxSupply()).to.equal(0);
    });

    it("Should reject max supply less than total minted", async function () {
      // Total minted is INITIAL_SUPPLY
      const invalidMaxSupply = INITIAL_SUPPLY - 1;

      await expect(
        sdcToken.connect(owner).setMaxSupply(invalidMaxSupply)
      ).to.be.revertedWith("New max supply must be >= total minted");
    });

    it("Should reject setMaxSupply from non-admin", async function () {
      await expect(
        sdcToken.connect(user1).setMaxSupply(20000000)
      ).to.be.reverted;
    });
  });

  describe("Supply Statistics", function () {
    it("Should return correct supply stats", async function () {
      const stats = await sdcToken.getSupplyStats();

      expect(stats.current).to.equal(ethers.parseEther(INITIAL_SUPPLY.toString()));
      expect(stats.minted).to.equal(ethers.parseEther(INITIAL_SUPPLY.toString()));
      expect(stats.burned).to.equal(0);
      expect(stats.max).to.equal(ethers.parseEther(MAX_SUPPLY.toString()));
    });

    it("Should calculate remaining mintable", async function () {
      const remaining = await sdcToken.remainingMintable();
      const expected = ethers.parseEther((MAX_SUPPLY - INITIAL_SUPPLY).toString());

      expect(remaining).to.equal(expected);
    });

    it("Should return max uint256 for unlimited supply", async function () {
      const SDCToken = await ethers.getContractFactory("SDCToken");
      const unlimitedToken = await SDCToken.deploy(owner.address, minter.address, 0, 0);
      await unlimitedToken.waitForDeployment();

      const remaining = await unlimitedToken.remainingMintable();
      expect(remaining).to.equal(ethers.MaxUint256);
    });
  });

  describe("Reward Constants", function () {
    it("Should have correct RSVP reward", async function () {
      expect(await sdcToken.RSVP_REWARD()).to.equal(ethers.parseEther("10"));
    });

    it("Should have correct ATTENDANCE reward", async function () {
      expect(await sdcToken.ATTENDANCE_REWARD()).to.equal(ethers.parseEther("20"));
    });

    it("Should have correct REFERRAL reward", async function () {
      expect(await sdcToken.REFERRAL_REWARD()).to.equal(ethers.parseEther("5"));
    });

    it("Should have correct BADGE_EARNED reward", async function () {
      expect(await sdcToken.BADGE_EARNED_REWARD()).to.equal(ethers.parseEther("15"));
    });
  });

  describe("ERC20 Permit", function () {
    it("Should support permit function", async function () {
      // Verify the contract has permit functionality
      expect(typeof sdcToken.permit).to.equal("function");
      expect(typeof sdcToken.nonces).to.equal("function");
      expect(typeof sdcToken.DOMAIN_SEPARATOR).to.equal("function");
    });
  });
});

// Helper function to get current block timestamp
async function getTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}
