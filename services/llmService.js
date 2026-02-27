// const OpenAI = require("openai");

// const client = new OpenAI({
//   apiKey: process.env.GROQ_API_KEY,
//   baseURL: "https://api.groq.com/openai/v1"
// });

// const MODEL = "llama-3.1-8b-instant"; // ✅ centralized model

// /************************************************
//   1️⃣ Generate Standup Question Per Ticket
// *************************************************/
// const generateTicketQuestion = async (ticket) => {
//   const prompt = `
// You are conducting a professional daily standup.

// Generate ONE concise question that collects:
// - current status
// - blockers (if any)
// - next day plan

// The question MUST clearly mention:
// - Ticket Key
// - Ticket Title

// Ticket Details:
// Key: ${ticket.ticket_key}
// Title: ${ticket.title}
// Priority: ${ticket.priority}
// Due Date: ${ticket.due_date}

// Return only the question.
// `;

//   const response = await client.chat.completions.create({
//     model: MODEL,
//     messages: [{ role: "user", content: prompt }],
//     temperature: 0.7
//   });

//   return response.choices[0].message.content.trim();
// };

// /************************************************
//   2️⃣ Extract Structured Update
// *************************************************/
// const extractStructuredUpdate = async (ticket, answer) => {
//   const prompt = `
// Extract structured JSON for this ticket update.

// Ticket:
// Key: ${ticket.ticket_key}
// Title: ${ticket.title}

// Return JSON in this format:

// {
//   "status": "",
//   "blockers": "",
//   "next_plan": ""
// }

// User response:
// "${answer}"

// Return only JSON.
// `;

//   const response = await client.chat.completions.create({
//     model: MODEL,   // ✅ FIXED HERE
//     messages: [{ role: "user", content: prompt }],
//     temperature: 0.2
//   });

//   return JSON.parse(response.choices[0].message.content);
// };

// /************************************************
//   3️⃣ Generate Daily Executive Project Summary
// *************************************************/
// const generateProjectSummary = async (projectName, updates) => {
//   const prompt = `
// You are generating an executive daily project report.

// Analyze ticket updates and generate structured JSON:

// {
//   "project_name": "${projectName}",
//   "overall_status": "",
//   "completion_percent": 0,
//   "blocked_issues": 0,
//   "key_accomplishments": [],
//   "next_focus": [],
//   "major_risks": []
// }

// Ticket updates:
// ${JSON.stringify(updates, null, 2)}

// Return only JSON.
// `;

//   const response = await client.chat.completions.create({
//     model: MODEL,
//     messages: [{ role: "user", content: prompt }],
//     temperature: 0.3
//   });

//   return JSON.parse(response.choices[0].message.content);
// };

// module.exports = {
//   generateTicketQuestion,
//   extractStructuredUpdate,
//   generateProjectSummary
// };

const OpenAI = require("openai");
 
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});
 
const MODEL = "llama-3.1-8b-instant";
 
/************************************************
  🔧 CONFIGURATION
*************************************************/
const MAX_TURNS = 8;     // max messages kept in memory (excluding system)
const MAX_ROUNDS = 3;    // max user follow-ups per ticket
 
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
const extractStructuredUpdate = async (ticket, conversationHistory) => {
  const conversationText = conversationHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n");
 
  const prompt = `
Extract structured JSON for this ticket update.
 
Ticket:
Key: ${ticket.ticket_key}
Title: ${ticket.title}
 
Conversation:
${conversationText}
 
Return JSON in this format:
 
{
  "status": "",
  "blockers": "",
  "next_plan": ""
}
 
Return only valid JSON.
`;
 
  const response = await client.chat.completions.create({
    model: MODEL,
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
 
Return only valid JSON.
`;
 
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });
 
  return JSON.parse(response.choices[0].message.content);
};
 
/************************************************
  4️⃣ Multi-turn Ticket Q&A With Limit
*************************************************/
const chatWithLimit = async (ticket, history = [], userMessage) => {
  // Initialize system message if first call
  if (history.length === 0) {
    history.push({
      role: "system",
      content: `
You are conducting a structured daily standup for the following ticket:
 
Key: ${ticket.ticket_key}
Title: ${ticket.title}
 
Collect:
- Current status
- Blockers
- Next plan
 
Ask follow-up questions ONLY if clarification is needed.
Keep responses concise and professional.
      `
    });
  }
 
  // Count user rounds
  const userRounds = history.filter(msg => msg.role === "user").length;
 
  if (userRounds >= MAX_ROUNDS) {
    // Auto-extract structured update when limit reached
    const structuredData = await extractStructuredUpdate(ticket, history);
 
    return {
      done: true,
      message: "Follow-up limit reached. Structured update generated.",
      structured: structuredData,
      history
    };
  }
 
  // Add user message
  history.push({
    role: "user",
    content: userMessage
  });
 
  // Sliding window trim (protect system message)
  if (history.length > MAX_TURNS + 1) {
    const systemMessage = history[0];
    const recentMessages = history.slice(-MAX_TURNS);
    history = [systemMessage, ...recentMessages];
  }
 
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: history,
    temperature: 0.5
  });
 
  const assistantReply = response.choices[0].message.content.trim();
 
  history.push({
    role: "assistant",
    content: assistantReply
  });
 
  return {
    done: false,
    message: assistantReply,
    history
  };
};
 
module.exports = {
  generateTicketQuestion,
  extractStructuredUpdate,
  generateProjectSummary,
  chatWithLimit
};


