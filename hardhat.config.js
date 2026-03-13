require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env.local"), override: true });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, ETH_SEPOLIA_RPC_URL } = process.env;

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL || "",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    sepolia: {
      url: ETH_SEPOLIA_RPC_URL || "",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
