const axios = require("axios");
require("dotenv").config();

const postPinataMetaData = async (metadata) => {
  const pinata_config = {
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
  };
  const data = {
    pinataOptions: {
      cidVersion: 1,
    },
    pinataContent: metadata,
  };
  const result = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    data,
    pinata_config
  );
  return result;
};

module.exports = {
  postPinataMetaData,
};
