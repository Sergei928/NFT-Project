const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const loggingSchema = new Schema({
  event_time: { type: Date },
  event_description: { type: String },
});

const Logging = mongoose.model("log", loggingSchema);
module.exports = Logging;
