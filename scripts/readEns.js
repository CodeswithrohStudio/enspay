const hre = require("hardhat");

async function main() {
  const ensName = process.env.TEST_ENS_NAME;
  if (!ensName) {
    throw new Error("Set TEST_ENS_NAME in .env (example: TEST_ENS_NAME=alice.eth)");
  }

  const provider = hre.ethers.provider;
  const resolver = await provider.getResolver(ensName);
  if (!resolver) {
    throw new Error(`No resolver found for ${ensName} on Sepolia.`);
  }

  const [token, network, dex, slippage, note, resolvedAddress] = await Promise.all([
    resolver.getText("enspay.token"),
    resolver.getText("enspay.network"),
    resolver.getText("enspay.dex"),
    resolver.getText("enspay.slippage"),
    resolver.getText("enspay.note"),
    resolver.getAddress()
  ]);

  console.log("ENS:", ensName);
  console.log("Resolved address:", resolvedAddress || "(empty)");
  console.log("enspay.token:", token || "(empty)");
  console.log("enspay.network:", network || "(empty)");
  console.log("enspay.dex:", dex || "(empty)");
  console.log("enspay.slippage:", slippage || "(empty)");
  console.log("enspay.note:", note || "(empty)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
