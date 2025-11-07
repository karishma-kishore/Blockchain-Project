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

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    backendMinter: backendMinter,
    contracts: {
      AchievementSBT: {
        address: achievementAddress,
        name: "SunDevilSync Achievement",
        symbol: "SDS-ACH"
      },
      Collectible721: {
        address: collectibleAddress,
        name: "SunDevilSync Collectible",
        symbol: "SDS-COL"
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
  console.log("AchievementSBT:", achievementAddress);
  console.log("Collectible721:", collectibleAddress);
  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${achievementAddress} "SunDevilSync Achievement" "SDS-ACH" "${deployer.address}" "${backendMinter}"`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${collectibleAddress} "SunDevilSync Collectible" "SDS-COL" "${deployer.address}" "${backendMinter}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
