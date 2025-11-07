const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Collectible721", function () {
  let collectible721;
  let owner, minter, user1, user2;
  let collectibleType;

  beforeEach(async function () {
    [owner, minter, user1, user2] = await ethers.getSigners();

    const Collectible721 = await ethers.getContractFactory("Collectible721");
    collectible721 = await Collectible721.deploy(
      "SunDevilSync Collectible",
      "SDS-COL",
      owner.address,
      minter.address
    );
    await collectible721.waitForDeployment();

    collectibleType = ethers.id("collectible_limited_edition");
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await collectible721.name()).to.equal("SunDevilSync Collectible");
      expect(await collectible721.symbol()).to.equal("SDS-COL");
    });

    it("Should grant roles correctly", async function () {
      const adminRole = await collectible721.DEFAULT_ADMIN_ROLE();
      const minterRole = await collectible721.MINTER_ROLE();
      
      expect(await collectible721.hasRole(adminRole, owner.address)).to.be.true;
      expect(await collectible721.hasRole(minterRole, minter.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should mint a new collectible NFT", async function () {
      const metadataURI = "ipfs://QmCollectible123";
      const series = 1;
      
      const tx = await collectible721.connect(minter).mint(
        user1.address,
        collectibleType,
        metadataURI,
        series
      );

      await expect(tx)
        .to.emit(collectible721, "CollectibleMinted");

      expect(await collectible721.ownerOf(0)).to.equal(user1.address);
      expect(await collectible721.tokenURI(0)).to.equal(metadataURI);
    });

    it("Should allow transfers (collectibles are transferable)", async function () {
      await collectible721.connect(minter).mint(
        user1.address,
        collectibleType,
        "ipfs://QmTest",
        1
      );

      await collectible721.connect(user1).transferFrom(user1.address, user2.address, 0);
      expect(await collectible721.ownerOf(0)).to.equal(user2.address);
    });

    it("Should track serial numbers correctly", async function () {
      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://1", 1);
      await collectible721.connect(minter).mint(user2.address, collectibleType, "ipfs://2", 1);

      const metadata1 = await collectible721.getTokenMetadata(0);
      const metadata2 = await collectible721.getTokenMetadata(1);

      expect(metadata1._serialNumber).to.equal(0);
      expect(metadata2._serialNumber).to.equal(1);
    });

    it("Should batch mint multiple collectibles", async function () {
      const recipients = [user1.address, user2.address];
      const types = [collectibleType, collectibleType];
      const uris = ["ipfs://QmTest1", "ipfs://QmTest2"];
      const series = 1;

      await collectible721.connect(minter).batchMint(recipients, types, uris, series);

      expect(await collectible721.ownerOf(0)).to.equal(user1.address);
      expect(await collectible721.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Scarcity Management", function () {
    it("Should set and enforce max supply", async function () {
      const maxSupply = 2;
      
      await collectible721.connect(owner).setMaxSupply(collectibleType, maxSupply);
      
      expect(await collectible721.maxSupply(collectibleType)).to.equal(maxSupply);

      // Mint up to max supply
      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://1", 1);
      await collectible721.connect(minter).mint(user2.address, collectibleType, "ipfs://2", 1);

      // Should reject exceeding max supply
      await expect(
        collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://3", 1)
      ).to.be.revertedWith("Max supply reached");
    });

    it("Should allow unlimited minting when max supply is 0", async function () {
      // Default max supply is 0 (unlimited)
      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://1", 1);
      await collectible721.connect(minter).mint(user2.address, collectibleType, "ipfs://2", 1);
      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://3", 1);

      expect(await collectible721.currentSupply(collectibleType)).to.equal(3);
    });

    it("Should emit MaxSupplySet event", async function () {
      await expect(collectible721.connect(owner).setMaxSupply(collectibleType, 100))
        .to.emit(collectible721, "MaxSupplySet")
        .withArgs(collectibleType, 100);
    });

    it("Should reject setting max supply below current supply", async function () {
      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://1", 1);
      await collectible721.connect(minter).mint(user2.address, collectibleType, "ipfs://2", 1);
      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://3", 1);

      await expect(
        collectible721.connect(owner).setMaxSupply(collectibleType, 2)
      ).to.be.revertedWith("Max supply cannot be less than current supply");
    });
  });

  describe("Series Management", function () {
    it("Should track different series", async function () {
      const series1 = 1;
      const series2 = 2;

      await collectible721.connect(minter).mint(user1.address, collectibleType, "ipfs://s1", series1);
      await collectible721.connect(minter).mint(user2.address, collectibleType, "ipfs://s2", series2);

      const metadata1 = await collectible721.getTokenMetadata(0);
      const metadata2 = await collectible721.getTokenMetadata(1);

      expect(metadata1._series).to.equal(series1);
      expect(metadata2._series).to.equal(series2);
    });
  });

  describe("Metadata", function () {
    beforeEach(async function () {
      await collectible721.connect(minter).mint(
        user1.address,
        collectibleType,
        "ipfs://QmTest",
        1
      );
    });

    it("Should return complete token metadata", async function () {
      const metadata = await collectible721.getTokenMetadata(0);
      
      expect(metadata._collectibleType).to.equal(collectibleType);
      expect(metadata._series).to.equal(1);
      expect(metadata._serialNumber).to.equal(0);
    });
  });

  describe("Pausability", function () {
    it("Should pause and unpause", async function () {
      await collectible721.connect(owner).pause();
      
      await expect(
        collectible721.connect(minter).mint(
          user1.address,
          collectibleType,
          "ipfs://QmTest",
          1
        )
      ).to.be.revertedWithCustomError(collectible721, "EnforcedPause");

      await collectible721.connect(owner).unpause();
      
      await collectible721.connect(minter).mint(
        user1.address,
        collectibleType,
        "ipfs://QmTest",
        1
      );
      
      expect(await collectible721.ownerOf(0)).to.equal(user1.address);
    });
  });

  describe("EIP-712 Permit Minting", function () {
    it("Should mint with valid permit signature", async function () {
      const deadline = (await time.latest()) + 3600;
      const metadataURI = "ipfs://QmTest";
      const series = 1;
      const nonce = await collectible721.nonces(user1.address);

      const domain = {
        name: "SunDevilSync Collectible",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await collectible721.getAddress()
      };

      const types = {
        MintPermit: [
          { name: "to", type: "address" },
          { name: "collectibleType", type: "bytes32" },
          { name: "metadataURI", type: "string" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      const value = {
        to: user1.address,
        collectibleType: collectibleType,
        metadataURI: metadataURI,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await minter.signTypedData(domain, types, value);

      await collectible721.mintWithPermit(
        user1.address,
        collectibleType,
        metadataURI,
        series,
        deadline,
        signature
      );

      expect(await collectible721.ownerOf(0)).to.equal(user1.address);
    });

    it("Should reject expired permit", async function () {
      const deadline = (await time.latest()) - 1;
      const signature = "0x" + "00".repeat(65);

      await expect(
        collectible721.mintWithPermit(
          user1.address,
          collectibleType,
          "ipfs://QmTest",
          1,
          deadline,
          signature
        )
      ).to.be.revertedWith("Permit expired");
    });
  });
});
