
const DailyUpdate = require("../models/DailyUpdate");
const ProjectSummary = require("../models/ProjectSummary");
const { generateProjectSummary } = require("./llmService");

const generateDailyProjectSummaries = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  try {
    // Get all today's updates
    const updates = await DailyUpdate.find({
      date: { $gte: todayStart, $lte: todayEnd }
    });

    if (updates.length === 0) {
      console.log("No updates found today.");
      return;
    }

    // Group updates by project
    const projectGroups = {};

    updates.forEach(update => {
      if (!projectGroups[update.project_name]) {
        projectGroups[update.project_name] = [];
      }
      projectGroups[update.project_name].push(update);
    });

    // Generate summary for each project
    for (const projectName in projectGroups) {
      const summary = await generateProjectSummary(
        projectName,
        projectGroups[projectName]
      );

      await ProjectSummary.findOneAndUpdate(
        {
          project_name: projectName,
          report_date: todayStart   // ✅ FIXED
        },
        {
          ...summary,
          project_name: projectName, // ensure it's saved
          report_date: todayStart,   // ✅ FIXED
          generated_at: new Date()
        },
        { upsert: true, new: true }
      );

      console.log(`Summary updated for ${projectName}`);
    }

  } catch (error) {
    console.error("Error generating summaries:", error);
  }
};

module.exports = { generateDailyProjectSummaries };