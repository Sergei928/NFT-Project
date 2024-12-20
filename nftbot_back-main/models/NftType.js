const mongoose = require("mongoose");

const nftTypeSchema = new mongoose.Schema({
  nftCount: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return value > 0;
      },
      message: "NFT Count must be greater than 0.",
    },
  },
  price: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return value > 0;
      },
      message: "Price must be greater than 0.",
    },
  },
});

const NftType = mongoose.model("NftType", nftTypeSchema);
module.exports = NftType;
