const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

const MODEL = "llama-3.1-8b-instant"; // ✅ centralized model

/************************************************
  1️⃣ Generate Standup Question Per Ticket
*************************************************/
const generateTicketQuestion = async (ticket) => {
  const prompt = `
You are conducting a professional daily standup.

Generate ONE concise question that collects:
- current status
- blockers (if any)
- next day plan

The question MUST clearly mention:
- Ticket Key
- Ticket Title

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
    temperature: 0.7
  });

  return response.choices[0].message.content.trim();
};

/************************************************
  2️⃣ Extract Structured Update
*************************************************/
const extractStructuredUpdate = async (ticket, answer) => {
  const prompt = `
Extract structured JSON for this ticket update.

Ticket:
Key: ${ticket.ticket_key}
Title: ${ticket.title}

Return JSON in this format:

{
  "status": "",
  "blockers": "",
  "next_plan": ""
}

User response:
"${answer}"

Return only JSON.
`;

  const response = await client.chat.completions.create({
    model: MODEL,   // ✅ FIXED HERE
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });

  return JSON.parse(response.choices[0].message.content);
};

/************************************************
  3️⃣ Generate Daily Executive Project Summary
*************************************************/
const generateProjectSummary = async (projectName, updates) => {
  const prompt = `
You are generating an executive daily project report.

Analyze ticket updates and generate structured JSON:

{
  "project_name": "${projectName}",
  "overall_status": "",
  "completion_percent": 0,
  "blocked_issues": 0,
  "key_accomplishments": [],
  "next_focus": [],
  "major_risks": []
}

Ticket updates:
${JSON.stringify(updates, null, 2)}

Return only JSON.
`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  return JSON.parse(response.choices[0].message.content);
};

module.exports = {
  generateTicketQuestion,
  extractStructuredUpdate,
  generateProjectSummary
};

