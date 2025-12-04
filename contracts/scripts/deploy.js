const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying SunDevilSync 2.0 contracts...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Get backend minter address from env or use deployer as default
  const backendMinter = process.env.BACKEND_MINTER_ADDRESS || deployer.address;
  console.log("Backend minter address:", backendMinter);

  // SDC Token configuration
  const SDC_INITIAL_SUPPLY = process.env.SDC_INITIAL_SUPPLY || 1000000;  // 1 million tokens
  const SDC_MAX_SUPPLY = process.env.SDC_MAX_SUPPLY || 100000000;        // 100 million tokens (0 = unlimited)

  // Deploy SDCToken (ERC-20)
  console.log("\nDeploying SDCToken...");
  const SDCToken = await hre.ethers.getContractFactory("SDCToken");
  const sdcToken = await SDCToken.deploy(
    deployer.address,    // admin
    backendMinter,       // minter
    SDC_INITIAL_SUPPLY,  // initial supply
    SDC_MAX_SUPPLY       // max supply
  );
  await sdcToken.waitForDeployment();
  const sdcTokenAddress = await sdcToken.getAddress();
  console.log("SDCToken deployed to:", sdcTokenAddress);
  console.log(`  Initial supply: ${SDC_INITIAL_SUPPLY} SDC`);
  console.log(`  Max supply: ${SDC_MAX_SUPPLY === 0 ? 'Unlimited' : SDC_MAX_SUPPLY + ' SDC'}`);

  // Deploy AchievementSBT
  console.log("\nDeploying AchievementSBT...");
  const AchievementSBT = await hre.ethers.getContractFactory("AchievementSBT");
  const achievementSBT = await AchievementSBT.deploy(
    "SunDevilSync Achievement",
    "SDS-ACH",
    deployer.address, // admin
    backendMinter      // minter
  );
  await achievementSBT.waitForDeployment();
  const achievementAddress = await achievementSBT.getAddress();
  console.log("AchievementSBT deployed to:", achievementAddress);

  // Deploy Collectible721
  console.log("\nDeploying Collectible721...");
  const Collectible721 = await hre.ethers.getContractFactory("Collectible721");
  const collectible721 = await Collectible721.deploy(
    "SunDevilSync Collectible",
    "SDS-COL",
    deployer.address, // admin
    backendMinter      // minter
  );
  await collectible721.waitForDeployment();
  const collectibleAddress = await collectible721.getAddress();
  console.log("Collectible721 deployed to:", collectibleAddress);

  // Deploy SunDevilBadge (ERC-721 badge contract used by backend)
  console.log("\nDeploying SunDevilBadge...");
  const SunDevilBadge = await hre.ethers.getContractFactory("SunDevilBadge");
  const sunDevilBadge = await SunDevilBadge.deploy();
  await sunDevilBadge.waitForDeployment();
  const badgeAddress = await sunDevilBadge.getAddress();
  console.log("SunDevilBadge deployed to:", badgeAddress);

  // Grant backend minter role if different from deployer
  if (backendMinter && backendMinter.toLowerCase() !== deployer.address.toLowerCase()) {
    const grantTx = await sunDevilBadge.setMinter(backendMinter, true);
    await grantTx.wait();
    console.log("Granted MINTER_ROLE to backend:", backendMinter);
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    backendMinter: backendMinter,
    contracts: {
      SDCToken: {
        address: sdcTokenAddress,
        name: "SunDevilSync Coin",
        symbol: "SDC",
        initialSupply: SDC_INITIAL_SUPPLY,
        maxSupply: SDC_MAX_SUPPLY
      },
      AchievementSBT: {
        address: achievementAddress,
        name: "SunDevilSync Achievement",
        symbol: "SDS-ACH"
      },
      Collectible721: {
        address: collectibleAddress,
        name: "SunDevilSync Collectible",
        symbol: "SDS-COL"
      },
      SunDevilBadge: {
        address: badgeAddress,
        name: "SunDevil Badge",
        symbol: "SDB"
      }
    },
    deployedAt: new Date().toISOString()
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `${hre.network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentFile);

  // Also save as latest
  const latestFile = path.join(deploymentsDir, `${hre.network.name}-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n=== Deployment Summary ===");
  console.log("SDCToken:", sdcTokenAddress);
  console.log("AchievementSBT:", achievementAddress);
  console.log("Collectible721:", collectibleAddress);
  console.log("SunDevilBadge:", badgeAddress);
  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${sdcTokenAddress} "${deployer.address}" "${backendMinter}" "${SDC_INITIAL_SUPPLY}" "${SDC_MAX_SUPPLY}"`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${achievementAddress} "SunDevilSync Achievement" "SDS-ACH" "${deployer.address}" "${backendMinter}"`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${collectibleAddress} "SunDevilSync Collectible" "SDS-COL" "${deployer.address}" "${backendMinter}"`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${badgeAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
