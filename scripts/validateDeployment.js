const hre = require("hardhat");
require("dotenv").config();

const ROUTER_ABI = [
  "function usdc() view returns (address)",
  "function swapRouter02() view returns (address)",
  "function DEFAULT_SLIPPAGE_BPS() view returns (uint256)"
];

async function main() {
  const routerAddress =
    process.env.NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS ||
    process.env.ENSPAY_ROUTER_ADDRESS ||
    "0xD07f07f038c202F8DEbc4345626466ef4AC93b99";

  const code = await hre.ethers.provider.getCode(routerAddress);
  if (code === "0x") {
    throw new Error(`No contract bytecode found at ${routerAddress}`);
  }

  const router = new hre.ethers.Contract(routerAddress, ROUTER_ABI, hre.ethers.provider);
  const [usdc, swapRouter02, defaultSlippageBps] = await Promise.all([
    router.usdc(),
    router.swapRouter02(),
    router.DEFAULT_SLIPPAGE_BPS()
  ]);

  console.log("Router address:", routerAddress);
  console.log("Bytecode present: yes");
  console.log("usdc():", usdc);
  console.log("swapRouter02():", swapRouter02);
  console.log("DEFAULT_SLIPPAGE_BPS():", defaultSlippageBps.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
