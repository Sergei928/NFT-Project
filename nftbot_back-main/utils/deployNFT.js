const { ethers } = require("ethers");
const { OpenSeaSDK, Chain } = require("opensea-js");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const network = process.env.NETWORK;
// Define RPC URL and Private Key
const RPC_URL =
  network === "testnet"
    ? process.env.SEPOLIA_RPC_URL
    : process.env.MAINNET_RPC_URL;
const PRIVATE_KEY =
  network === "testnet"
    ? process.env.SEPOLIA_PRIVATE_KEY
    : process.env.MAINNET_PRIVATE_KEY;

// Define ABI and Bytecode of the smart contract
const ABI = fs.readFileSync("bin/contract/NFTBot.abi", "utf8");
// Load the bytecode from the .bin file
const BYTECODE = fs.readFileSync("bin/contract/NFTBot.bin", "utf8");

// Define provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const opensea = new OpenSeaSDK(wallet, {
  chain: network === "testnet" ? Chain.Sepolia : Chain.Polygon, // Chain.Mainnet,
  apiKey: process.env.OPENSEA_KEY,
});
// Deploy contract function
const deployContract = async (name, symbol) => {
  // Create a factory instance to deploy the contract
  const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);

  console.log("Deploying contract...");

  // Deploy the contract
  const contract = await factory.deploy(name, symbol);

  // Instead of `await contract.deployed()`, simply wait for the deployment to be mined
  const receipt = await contract.waitForDeployment();

  console.log("Contract deployed successfully!");

  console.log("Contract Address:", contract.target);

  return contract.target;
};

// Mint NFT function
const mintNFT = async (contractAddress, recipientAddress, tokenUri) => {
  // Create a contract instance using the deployed contract address
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  console.log(`Minting NFT to address: ${recipientAddress}...`);

  // Call the mint function of the contract to mint an NFT
  const tx = await contract.mint(recipientAddress, tokenUri);

  // Wait for the transaction to be confirmed
  await tx.wait();

  // approve for OpenSea contract
  const tx1 = await contract.setApprovalForAll(
    "0x1E0049783F008A0085193E00003D00cd54003c71",
    true
  );
  await tx1.wait();

  console.log(`NFT minted successfully! Transaction Hash: ${tx.hash}`);
  return tx.hash;
};

const listForSale = async (contractAddress, tokenId, priceInETH = 0) => {
  // Calculate price in Wei
  // const feeToOpenseaInETH = (priceInETH * 25) / 1000;
  // const assetToOwnerInETH = priceInETH - feeToOpenseaInETH;
  // console.log(feeToOpenseaInETH, assetToOwnerInETH);
  // const assetToOwnerInWei = ethers.parseEther(assetToOwnerInETH.toString());
  // const feeToOpenseaInWei = ethers.parseEther(feeToOpenseaInETH.toString());
  // console.log(assetToOwnerInWei, feeToOpenseaInWei);
  // TODO: Fill in the token address and token ID of the NFT you want to sell, as well as the price

  const listing = {
    accountAddress: wallet.address,
    startAmount: priceInETH,
    asset: {
      tokenAddress: contractAddress,
      tokenId: tokenId,
    },
  };

  const response = await opensea.createListing(listing);
  console.log(
    "Successfully created a listing with orderHash:",
    response.orderHash
  );
  // } catch (error) {
  //   console.error("Error in createListing:", error);
  // }
};

module.exports = {
  deployContract,
  mintNFT,
  listForSale,
};
