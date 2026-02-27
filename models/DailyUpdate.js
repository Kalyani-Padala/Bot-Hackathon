const mongoose = require("mongoose");

const DailyUpdateSchema = new mongoose.Schema({
  employee_name: String,
  ticket_key: String,
  project_name: String,
  date: { type: Date, default: Date.now },
  status: String,
  blockers: String,
  next_plan: String
});

module.exports = mongoose.model("DailyUpdate", DailyUpdateSchema);