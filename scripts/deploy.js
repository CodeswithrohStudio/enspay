const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const usdcAddress = process.env.BASE_SEPOLIA_USDC_ADDRESS;
  const swapRouterAddress =
    process.env.BASE_SEPOLIA_SWAP_ROUTER02 || "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";

  if (!usdcAddress) {
    throw new Error("Missing BASE_SEPOLIA_USDC_ADDRESS in .env");
  }

  const ENSPayRouter = await hre.ethers.getContractFactory("ENSPayRouter");
  const router = await ENSPayRouter.deploy(usdcAddress, swapRouterAddress);
  await router.waitForDeployment();

  const address = await router.getAddress();
  console.log("ENSPayRouter deployed to:", address);
  console.log("USDC:", usdcAddress);
  console.log("SwapRouter02:", swapRouterAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
