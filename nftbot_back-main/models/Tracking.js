const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TrackingSchema = new Schema({
  nft_name: { type: String },
  collection: { type: String },
  collection_generation: { type: String },
  nft_number: { type: String },
  issue_date: { type: Date },
  purchase_date: { type: Date },
  buyer_address: { type: String },
});

const Tracking = mongoose.model("tracking", TrackingSchema);
module.exports = Tracking;
