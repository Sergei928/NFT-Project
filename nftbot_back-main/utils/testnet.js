const axios = require("axios");
const fs = require("fs/promises");
const Todo = require("../models/Todo");
const { Chain } = require("opensea-js");
require("dotenv").config();
const event_type = [
  "cancel",
  "sale",
  "transfer",
  "redemption",
  "order",
  "offer",
  "listing",
  "all",
];
const getevent_url = "https://testnets-api.opensea.io/api/v2/events";
const get_events_by_collection_url =
  "https://testnets-api.opensea.io/api/v2/events/collection";
const get_collection_url = "https://testnets-api.opensea.io/api/v2/collections";
const network = process.env.NETWORK;
const chain = network === "testnet" ? Chain.Sepolia : Chain.Polygon;

const trackSalesOnTestNet = async (todos) => {
  try {
    const result = [];
    let previousSaleCount = 0; // Tracks the previous sale count
    let salesCount = 0; // Tracks total sales across batches
    const SALES_MILESTONE = 10; // Define your sales milestone
    const BATCH_SIZE = 5; // Define batch size for release

    for (const item of todos) {
      // Fetch collection
      const collection = await generateCollectionByContract(
        item.contractAddress
      );

      // Delay between API calls to avoid 429 errors
      await delay(1000); // Adjust delay based on the rate limit of your API

      // Fetch issue date
      const issueDate = await getIssuedDate(collection);

      // Delay to prevent back-to-back API calls
      await delay(1000);

      // Fetch events
      const events = await getEventsByCollection(collection);

      let purchase_date = "";
      let buyer_address = "";

      const currentSaleCount = events.length;

      if (currentSaleCount > previousSaleCount) {
        const newSales = currentSaleCount - previousSaleCount;
        previousSaleCount = currentSaleCount;
        salesCount += newSales;

        if (salesCount >= SALES_MILESTONE) {
          await releaseBatch(BATCH_SIZE); // Trigger release if milestone is reached
          salesCount = 0;
        }
      }

      if (currentSaleCount !== 0) {
        const latestEvent = events[0]; // Assuming events are sorted by timestamp
        purchase_date = await convertTimestampToDate(
          latestEvent.event_timestamp
        );
        buyer_address = latestEvent.buyer || "";
      }

      result.push({
        nft_name: item.nftName,
        collection: collection,
        collection_generation: item.prompt,
        nft_number: `${item.nftCount}-00${item.order}`,
        issue_date: issueDate || "",
        purchase_date: purchase_date || "",
        buyer_address: buyer_address || "",
      });

      // console.log(`Processed collection: ${collection}`);
    }

    return result;
  } catch (error) {
    console.error("Error tracking sales:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const getIssuedDate = async (collection_slug) => {
  const url = `${get_collection_url}/${collection_slug}`;
  const response = await axios.get(url, {
    headers: {
      "X-API-KEY": process.env.OPENSEA_KEY,
    },
    params: {
      collection_slug: collection_slug,
    },
  });
  const date = new Date(response.data.created_date);
  return date.toISOString();
};

const generateCollectionByContract = async (contract) => {
  const url = `https://testnets-api.opensea.io/api/v2/chain/${chain}/contract/${contract}`;

  const response = await axios.get(url, {
    headers: {
      "X-API-KEY": process.env.OPENSEA_KEY,
    },
    params: {
      address: contract,
      chain: chain,
      event_type: "sale",
      limit: 50,
    },
  });

  return response.data.collection;
};

const convertTimestampToDate = async (timeStamp) => {
  const date = new Date(timeStamp * 1000);
  const formattedDate = date.toISOString().split("T")[0];
  return formattedDate;
};

const getEventsByCollection = async (collection_slug) => {
  try {
    const url = `${get_events_by_collection_url}/${collection_slug}`;

    const response = await axios.get(url, {
      headers: {
        "X-API-KEY": process.env.OPENSEA_KEY,
      },
      params: {
        collection_slug: collection_slug,
        event_type: "sale",
        limit: 50,
      },
    });
    return response.data["asset_events"];
  } catch (error) {
    console.log(error.message);
  }
};

const releaseBatch = async (batchSize) => {};

module.exports = {
  trackSalesOnTestNet,
};
