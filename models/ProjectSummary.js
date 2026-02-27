
const mongoose = require("mongoose");

const ProjectSummarySchema = new mongoose.Schema({

  // 🔹 Basic Info
  project_name: String,
  report_date: { type: Date, default: Date.now },
  sprint_name: String,
  overall_status: String,
  completion_percent: Number,

  // 🔹 Today Progress
  total_updates_today: Number,
  tickets_completed_today: Number,
  tickets_in_progress: Number,
  tickets_in_todo: Number,
  story_points_completed_today: Number,

  key_accomplishments: [String],

  // 🔹 Blockers & Risks
  blocked_issues_count: Number,
  blocker_details: [
    {
      ticket_key: String,
      owner: String,
      blocker_description: String,
      days_blocked: Number
    }
  ],

  new_risks_identified: [String],
  escalations_required: Boolean,

  // 🔹 Next Day Plan
  next_day_focus: [String],
  high_priority_tasks: [String],

  // 🔹 Team Snapshot
  total_team_members_active_today: Number,
  avg_utilization_percent: Number,

  individual_utilization: [
  {
    team_member: String,
    role: String,
    tickets_worked_on: Number,
    story_points_handled: Number,
    utilization_percent: Number
  }
],

  // 🔹 Health
  delivery_health: String,
  quality_health: String,
  resource_health: String,
  overall_health_score: Number,

  generated_at: { type: Date, default: Date.now }

});

module.exports = mongoose.model("ProjectSummary", ProjectSummarySchema);