
const OpenAI = require("openai");
 
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});
 
const MODEL = "llama-3.1-8b-instant";
 
/************************************************
  🔹 Conversation Stages
*************************************************/
const STAGES = {
  STATUS: "status",
  BLOCKERS: "blockers",
  NEXT_PLAN: "next_plan",
  COMPLETE: "complete"
};
 
/************************************************
  1️⃣ Generate Conversational Standup Question
*************************************************/
const generateTicketQuestion = async (ticket, stage, context = {}) => {
 
  let instruction = "";
 
  if (stage === STAGES.STATUS) {
    instruction = `
Ask ONLY about the current status of this ticket.
Do NOT ask about blockers or next plan.
Keep it concise.
`;
  }
 
  if (stage === STAGES.BLOCKERS) {
    instruction = `
User current status:
"${context.status}"
 
Now ask ONLY about blockers.
If status indicates completion, phrase naturally.
Do NOT ask about next plan.
`;
  }
 
  if (stage === STAGES.NEXT_PLAN) {
    instruction = `
User shared:
Status: "${context.status}"
Blockers: "${context.blockers}"
 
Now ask ONLY about their next planned step.
Keep it concise.
`;
  }
 
  const prompt = `
You are conducting a professional daily standup.
 
${instruction}
 
Ticket Details:
Key: ${ticket.ticket_key}
Title: ${ticket.title}
Priority: ${ticket.priority}
Due Date: ${ticket.due_date}
 
Return only the question.
`;
 
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5
  });
 
  return response.choices[0].message.content.trim();
};
 
/************************************************
  2️⃣ Process User Answer Deterministically
*************************************************/
const processStandupAnswer = (stage, answer, state) => {
 
  if (stage === STAGES.STATUS) {
    return {
      nextStage: STAGES.BLOCKERS,
      updatedState: {
        ...state,
        status: answer
      }
    };
  }
 
  if (stage === STAGES.BLOCKERS) {
    return {
      nextStage: STAGES.NEXT_PLAN,
      updatedState: {
        ...state,
        blockers: answer
      }
    };
  }
 
  if (stage === STAGES.NEXT_PLAN) {
    return {
      nextStage: STAGES.COMPLETE,
      updatedState: {
        ...state,
        next_plan: answer
      }
    };
  }
 
  return {
    nextStage: STAGES.COMPLETE,
    updatedState: state
  };
};
 
//************************************************
//   3️⃣ Generate Daily Executive Project Summary
// *************************************************/
const generateProjectSummary = async (projectName, updates) => {

  const prompt = `
You are a senior PMO executive assistant.

Generate a concise DAILY executive project report
from the provided ticket updates.

Return STRICTLY valid JSON in this exact structure:

{
  "project_name": "${projectName}",
  "sprint_name": "",
  "overall_status": "",
  "completion_percent": 0,

  "total_updates_today": 0,
  "tickets_completed_today": 0,
  "tickets_in_progress": 0,
  "tickets_in_todo":0,
  "story_points_completed_today": 0,

  "key_accomplishments": [],

  "blocked_issues_count": 0,
  "blocker_details": [
    {
      "ticket_key": "",
      "owner": "",
      "blocker_description": "",
      "days_blocked": 0
    }
  ],
  
   "individual_utilization": [
    {
      "team_member": "",
      "role": "",
      "tickets_worked_on": 0,
      "story_points_handled": 0,
      "utilization_percent": 0
    }
  ],

  "new_risks_identified": [],
  "escalations_required": false,

  "next_day_focus": [],
  "high_priority_tasks": [],

  "total_team_members_active_today": 0,
  "avg_utilization_percent": 0,

  "delivery_health": "",
  "quality_health": "",
  "resource_health": "",
  "overall_health_score": 0
}

Guidelines:
- overall_status must be one of: "On Track", "At Risk", "Delayed"
- delivery/quality/resource health must be: "Green", "Amber", or "Red"
- completion_percent must be realistic based on updates
- escalations_required must be true if major blockers exist
- Keep accomplishments and next_day_focus concise executive bullets

Ticket Updates:
${JSON.stringify(updates, null, 2)}

Return ONLY JSON. No explanation.
`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });

  return JSON.parse(response.choices[0].message.content);
};
module.exports = {
  STAGES,
  generateTicketQuestion,
  processStandupAnswer,
  generateProjectSummary
};
 

