const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  ticket_key: String,
  title: String,
  description: String,
  assignee: String,
  priority: String,
  due_date: Date,
  story_points: Number,
  project_name: String,
  fetched_date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ticket", TicketSchema);