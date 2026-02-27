const axios = require("axios");
const Ticket = require("../models/Ticket");

const fetchJiraTickets = async (assigneeName) => {
  const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  const auth = Buffer.from(
    `${JIRA_EMAIL}:${JIRA_API_TOKEN}`
  ).toString("base64");

  const jql = `assignee="${assigneeName}"`;

  const response = await axios.get(
    `https://${JIRA_DOMAIN}/rest/api/3/search/jql`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      },
      params: {
        jql,
        fields:
          "summary,description,assignee,priority,duedate,customfield_10016,project"
      }
    }
  );

  const issues = response.data.issues;

  const cleaned = [];

  for (const issue of issues) {
    const ticket = {
      ticket_key: issue.key,
      title: issue.fields.summary,
      description:
        issue.fields.description?.content?.[0]?.content?.[0]?.text || "",
      assignee: issue.fields.assignee?.displayName,
      priority: issue.fields.priority?.name,
      due_date: issue.fields.duedate,
      story_points: issue.fields.customfield_10016 || 0,
      project_name: issue.fields.project?.name
    };

    await Ticket.findOneAndUpdate(
      { ticket_key: ticket.ticket_key },
      ticket,
      { upsert: true }
    );

    cleaned.push(ticket);
  }

  return cleaned;
};

module.exports = { fetchJiraTickets };