const mongoose = require("mongoose");

const ProjectSummarySchema = new mongoose.Schema({
  project_name: String,
  date: { type: Date, default: Date.now },
  overall_status: String,
  completion_percent: Number,
  blocked_issues: Number,
  key_accomplishments: [String],
  next_focus: [String],
  major_risks: [String]
});

module.exports = mongoose.model("ProjectSummary", ProjectSummarySchema);