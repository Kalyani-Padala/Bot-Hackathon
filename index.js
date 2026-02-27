require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { BotFrameworkAdapter } = require("botbuilder");
const cron = require("node-cron");
const { generateDailyProjectSummaries } = require("./services/summaryService");

const { fetchJiraTickets } = require("./services/jiraService");
const {
  generateTicketQuestion,
  extractStructuredUpdate,
  generateProjectSummary
} = require("./services/llmService");

const DailyUpdate = require("./models/DailyUpdate");
const ProjectSummary = require("./models/ProjectSummary");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("Mongo Error:", err));

const app = express();
app.use(express.json());

const adapter = new BotFrameworkAdapter({});

let userState = {};

/************************************************
  BOT ENDPOINT
*************************************************/
app.post("/api/messages", async (req, res) => {
  await adapter.processActivity(req, res, async (context) => {

    const userId = context.activity.from.id;

    if (!userState[userId]) {
      userState[userId] = { step: 0 };
    }

    const state = userState[userId];
    const userMessage = context.activity.text?.trim();

    /********************************************
      STEP 0 → Ask Name
    *********************************************/
    if (state.step === 0) {
      await context.sendActivity("Enter your name:");
      state.step = 1;
      return;
    }

    /********************************************
      STEP 1 → Fetch Jira Tickets
    *********************************************/
    if (state.step === 1) {
      state.employeeName = userMessage;

      state.tickets = await fetchJiraTickets(state.employeeName);

      if (!state.tickets || state.tickets.length === 0) {
        await context.sendActivity("No active Jira tickets found for you today.");
        state.step = 0;
        return;
      }

      state.currentIndex = 0;
      state.step = 2;
    }

    /********************************************
      STEP 2 → Ask Ticket Question OR Finish
    *********************************************/
    if (state.step === 2) {

      if (state.currentIndex < state.tickets.length) {

        const ticket = state.tickets[state.currentIndex];
        const question = await generateTicketQuestion(ticket);

        await context.sendActivity(question);

        state.step = 3;
        return;
      }

      // ✅ All tickets completed
      const today = new Date();
      today.setHours(0,0,0,0);

      const updates = await DailyUpdate.find({
        employee_name: state.employeeName,
        createdAt: { $gte: today }
      });

      const projectName = state.tickets[0]?.project_name;

      const summary = await generateProjectSummary(projectName, updates);

      await ProjectSummary.create({
        project_name: projectName,
        summary
      });

      await context.sendActivity("All tickets completed for today ✅");
      await context.sendActivity("Executive Summary Generated:");
      await context.sendActivity(JSON.stringify(summary, null, 2));
      await context.sendActivity("Thank you. Have a productive day 🚀");

      state.step = 0;
      return;
    }

    /********************************************
      STEP 3 → Save Update → Move Next Ticket
    *********************************************/
    if (state.step === 3) {

        const ticket = state.tickets[state.currentIndex];

        const structured = await extractStructuredUpdate(
            ticket,
            userMessage
        );

        await DailyUpdate.create({
            employee_name: state.employeeName,
            ticket_key: ticket.ticket_key,
            project_name: ticket.project_name,
            status: structured.status,
            blockers: structured.blockers,
            next_plan: structured.next_plan,
            createdAt: new Date()
        });

        await context.sendActivity("Update recorded ✅");

        state.currentIndex++;

        // 🔥 Immediately handle next ticket in same turn
        if (state.currentIndex < state.tickets.length) {

            const nextTicket = state.tickets[state.currentIndex];
            const question = await generateTicketQuestion(nextTicket);

            await context.sendActivity(question);

            state.step = 3;  // stay in answer mode
            return;

        } else {

            // All tickets finished
            await context.sendActivity("All tickets completed for today ✅");
            await context.sendActivity("Thank you. Have a productive day 🚀");

            state.step = 0;
            return;
        }
        }

  });
});



// 🔥 Manual trigger for daily summary
app.get("/generate-daily-summary", async (req, res) => {
  try {
    console.log("Manual daily summary triggered...");

    await generateDailyProjectSummaries();

    res.json({
      success: true,
      message: "Daily project summaries generated successfully."
    });

  } catch (error) {
    console.error("Error generating summaries:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate daily summaries",
      error: error.message
    });
  }
});

/************************************************
  START SERVER
*************************************************/
app.listen(3978, () =>
  console.log("Bot running at http://localhost:3978")
);



/************************************************
  OPTIONAL DAILY CRON SUMMARY (6 PM)
*************************************************/
cron.schedule("0 18 * * *", async () => {
  console.log("Running scheduled daily summary job...");
});