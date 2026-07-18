require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "11".repeat(32);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Injective EVM testnet — verify RPC URL + chainId against current Injective docs
    // (docs.injective.network) before deploying; these change as testnets get reset.
    injectiveTestnet: {
      url: process.env.INJECTIVE_TESTNET_RPC || "https://k8s.testnet.json-rpc.injective.network/",
      chainId: 1439,
      accounts: [PRIVATE_KEY],
    },
    injectiveMainnet: {
      url: process.env.INJECTIVE_MAINNET_RPC || "https://sentry.evm-rpc.injective.network/",
      chainId: 1776,
      accounts: [PRIVATE_KEY],
    },
  },
};
