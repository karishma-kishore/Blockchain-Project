const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AchievementSBT", function () {
  let achievementSBT;
  let owner, minter, user1, user2;
  let eventId, badgeType;

  beforeEach(async function () {
    [owner, minter, user1, user2] = await ethers.getSigners();

    const AchievementSBT = await ethers.getContractFactory("AchievementSBT");
    achievementSBT = await AchievementSBT.deploy(
      "SunDevilSync Achievement",
      "SDS-ACH",
      owner.address,
      minter.address
    );
    await achievementSBT.waitForDeployment();

    eventId = ethers.id("event_hackathon_2025");
    badgeType = ethers.id("badge_attendance");
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await achievementSBT.name()).to.equal("SunDevilSync Achievement");
      expect(await achievementSBT.symbol()).to.equal("SDS-ACH");
    });

    it("Should grant admin role to owner", async function () {
      const adminRole = await achievementSBT.DEFAULT_ADMIN_ROLE();
      expect(await achievementSBT.hasRole(adminRole, owner.address)).to.be.true;
    });

    it("Should grant minter role to minter", async function () {
      const minterRole = await achievementSBT.MINTER_ROLE();
      expect(await achievementSBT.hasRole(minterRole, minter.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should mint a new achievement NFT", async function () {
      const metadataURI = "ipfs://QmTest123";
      
      const tx = await achievementSBT.connect(minter).mint(
        user1.address,
        eventId,
        badgeType,
        metadataURI
      );

      await expect(tx)
        .to.emit(achievementSBT, "AchievementMinted")
        .withArgs(0, user1.address, eventId, badgeType, metadataURI, await time.latest());

      expect(await achievementSBT.ownerOf(0)).to.equal(user1.address);
      expect(await achievementSBT.tokenURI(0)).to.equal(metadataURI);
    });

    it("Should set token as non-transferable by default", async function () {
      await achievementSBT.connect(minter).mint(
        user1.address,
        eventId,
        badgeType,
        "ipfs://QmTest"
      );

      expect(await achievementSBT.transferLock(0)).to.be.true;
    });

    it("Should reject minting from non-minter", async function () {
      await expect(
        achievementSBT.connect(user1).mint(
          user1.address,
          eventId,
          badgeType,
          "ipfs://QmTest"
        )
      ).to.be.reverted;
    });

    it("Should batch mint multiple tokens", async function () {
      const recipients = [user1.address, user2.address];
      const eventIds = [eventId, eventId];
      const badgeTypes = [badgeType, badgeType];
      const uris = ["ipfs://QmTest1", "ipfs://QmTest2"];

      await achievementSBT.connect(minter).batchMint(
        recipients,
        eventIds,
        badgeTypes,
        uris
      );

      expect(await achievementSBT.ownerOf(0)).to.equal(user1.address);
      expect(await achievementSBT.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Transfer Lock", function () {
    beforeEach(async function () {
      await achievementSBT.connect(minter).mint(
        user1.address,
        eventId,
        badgeType,
        "ipfs://QmTest"
      );
    });

    it("Should prevent transfer when locked", async function () {
      await expect(
        achievementSBT.connect(user1).transferFrom(user1.address, user2.address, 0)
      ).to.be.revertedWith("Token is non-transferable");
    });

    it("Should allow admin to unlock token", async function () {
      await achievementSBT.connect(owner).setTransferLock(0, false);
      
      expect(await achievementSBT.transferLock(0)).to.be.false;
      
      await achievementSBT.connect(user1).transferFrom(user1.address, user2.address, 0);
      expect(await achievementSBT.ownerOf(0)).to.equal(user2.address);
    });

    it("Should emit TransferLockSet event", async function () {
      await expect(achievementSBT.connect(owner).setTransferLock(0, false))
        .to.emit(achievementSBT, "TransferLockSet")
        .withArgs(0, false);
    });
  });

  describe("Revocation", function () {
    beforeEach(async function () {
      await achievementSBT.connect(minter).mint(
        user1.address,
        eventId,
        badgeType,
        "ipfs://QmTest"
      );
    });

    it("Should allow admin to revoke token", async function () {
      const reason = "Fraudulent attendance";
      
      await expect(achievementSBT.connect(owner).revoke(0, reason))
        .to.emit(achievementSBT, "AchievementRevoked")
        .withArgs(0, reason, owner.address, await time.latest());

      expect(await achievementSBT.isRevoked(0)).to.be.true;
      expect(await achievementSBT.revocationReason(0)).to.equal(reason);
    });

    it("Should prevent double revocation", async function () {
      await achievementSBT.connect(owner).revoke(0, "Reason 1");
      
      await expect(
        achievementSBT.connect(owner).revoke(0, "Reason 2")
      ).to.be.revertedWith("Already revoked");
    });

    it("Should reject revocation from non-admin", async function () {
      await expect(
        achievementSBT.connect(user1).revoke(0, "Invalid")
      ).to.be.reverted;
    });
  });

  describe("Metadata", function () {
    beforeEach(async function () {
      await achievementSBT.connect(minter).mint(
        user1.address,
        eventId,
        badgeType,
        "ipfs://QmTest"
      );
    });

    it("Should return complete token metadata", async function () {
      const metadata = await achievementSBT.getTokenMetadata(0);
      
      expect(metadata._eventId).to.equal(eventId);
      expect(metadata._badgeType).to.equal(badgeType);
      expect(metadata._transferLock).to.be.true;
      expect(metadata._isRevoked).to.be.false;
    });
  });

  describe("Pausability", function () {
    it("Should pause and unpause", async function () {
      await achievementSBT.connect(owner).pause();
      
      await expect(
        achievementSBT.connect(minter).mint(
          user1.address,
          eventId,
          badgeType,
          "ipfs://QmTest"
        )
      ).to.be.revertedWithCustomError(achievementSBT, "EnforcedPause");

      await achievementSBT.connect(owner).unpause();
      
      await achievementSBT.connect(minter).mint(
        user1.address,
        eventId,
        badgeType,
        "ipfs://QmTest"
      );
      
      expect(await achievementSBT.ownerOf(0)).to.equal(user1.address);
    });
  });

  describe("EIP-712 Permit Minting", function () {
    it("Should mint with valid permit signature", async function () {
      const deadline = (await time.latest()) + 3600;
      const metadataURI = "ipfs://QmTest";
      const nonce = await achievementSBT.nonces(user1.address);

      // Get domain separator
      const domain = {
        name: "SunDevilSync Achievement",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await achievementSBT.getAddress()
      };

      const types = {
        MintPermit: [
          { name: "to", type: "address" },
          { name: "eventId", type: "bytes32" },
          { name: "badgeType", type: "bytes32" },
          { name: "metadataURI", type: "string" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      const value = {
        to: user1.address,
        eventId: eventId,
        badgeType: badgeType,
        metadataURI: metadataURI,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await minter.signTypedData(domain, types, value);

      await achievementSBT.mintWithPermit(
        user1.address,
        eventId,
        badgeType,
        metadataURI,
        deadline,
        signature
      );

      expect(await achievementSBT.ownerOf(0)).to.equal(user1.address);
    });

    it("Should reject expired permit", async function () {
      const deadline = (await time.latest()) - 1; // Past deadline
      const signature = "0x" + "00".repeat(65); // Dummy signature

      await expect(
        achievementSBT.mintWithPermit(
          user1.address,
          eventId,
          badgeType,
          "ipfs://QmTest",
          deadline,
          signature
        )
      ).to.be.revertedWith("Permit expired");
    });
  });
});
