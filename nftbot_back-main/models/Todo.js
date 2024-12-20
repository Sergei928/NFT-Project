const mongoose = require("mongoose");
const { PROGRESS_STATUS, PENDING } = require("../config/constants");

const todoSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  price: { type: Number, required: true },
  nftName: { type: String, required: true },
  nftSymbol: { type: String, required: true },
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
  imgGeneratedCount: { type: Number, default: 0 },
  mintCount: { type: Number, default: 0 },
  listCount: { type: Number, default: 0 },
  contractAddress: { type: String },
  status: {
    type: String,
    enum: PROGRESS_STATUS,
    default: PENDING,
  },
  isFailure: { type: Boolean, default: false },
  isPaused: { type: Boolean, default: false },
  images: [{ type: String }], // New field to store image URLs
  order: { type: Number, default: 0 },
});

const Todo = mongoose.model("Todo", todoSchema);
module.exports = Todo;
