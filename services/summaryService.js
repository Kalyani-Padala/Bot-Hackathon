const DailyUpdate = require("../models/DailyUpdate");
const ProjectSummary = require("../models/ProjectSummary");
const { generateProjectSummary } = require("./llmService");

const generateDailyProjectSummaries = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

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
        date: todayStart
      },
      {
        ...summary,
        date: todayStart
      },
      { upsert: true, new: true }
    );

    console.log(`Summary updated for ${projectName}`);
  }
};

module.exports = { generateDailyProjectSummaries };