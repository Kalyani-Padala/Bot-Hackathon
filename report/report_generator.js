const puppeteer = require("puppeteer");
const connectDB = require("../mongodb");   // remove .js if not needed
const path = require("path");
const fs = require("fs");

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

module.exports = async function generateReport() {
  try {
    const data = await connectDB();
    console.log("Data fetched from MongoDB:");
    if (!data || data.length === 0) {
      throw new Error("No report data found.");
    }
    const filePath = await generatePDF(data);
    return filePath;
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}

function aggregatePortfolio(projects) {

  const totalProjects = projects.length;

  const avgCompletion = projects.reduce((sum, p) => sum + p.completion_percent, 0) / totalProjects;

  const avgHealth = projects.reduce((sum, p) => sum + p.overall_health_score, 0) / totalProjects;

  const avgUtilization = projects.reduce((sum, p) => sum + p.avg_utilization_percent, 0) / totalProjects;

  const totalBlocked = projects.reduce((sum, p) => sum + p.blocked_issues_count, 0);

  const onTrack = projects.filter(p => p.overall_status === "On Track").length;

  const atRisk = projects.filter(p => p.overall_status === "At Risk").length;

  return {

    totalProjects,

    avgCompletion: avgCompletion.toFixed(1),

    avgHealth: avgHealth.toFixed(1),

    avgUtilization: avgUtilization.toFixed(1),

    totalBlocked,

    onTrack,

    atRisk

  };

}

async function generatePDF(projects) {
    const portfolio = aggregatePortfolio(projects);

    const reportsDir = path.join(__dirname, "../reports");
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `Weekly_Manager_Report_${timestamp}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const formatDate = (date) =>
        new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

    // --- Project Ticket Data ---
    const projectTicketsCompleted = JSON.stringify(projects.map(p => p.tickets_completed_today || 0));
    const projectTicketsInProgress = JSON.stringify(projects.map(p => p.tickets_in_progress || 0));
    const projectTicketsToDo = JSON.stringify(projects.map(p => p.tickets_in_todo || 0));

    const totalTicketsCompleted = projects.reduce((s, p) => s + (p.tickets_completed_today || 0), 0);
    const totalTicketsInProgress = projects.reduce((s, p) => s + (p.tickets_in_progress || 0), 0);
    const totalTicketsToDo = projects.reduce((s, p) => s + (p.tickets_in_todo || 0), 0);
    const totalStoryPoints = projects.reduce((s, p) => s + p.story_points_completed_today, 0);
    const totalTeamMembers = projects.reduce((s, p) => s + p.total_team_members_active_today, 0);
    const totalUpdates = projects.reduce((s, p) => s + p.total_updates_today, 0);
    const escalations = projects.filter(p => p.escalations_required).length;

    const allAccomplishments = projects.flatMap(p => p.key_accomplishments);
    const allNextFocus = projects.flatMap(p => p.next_day_focus);
    const allRisks = projects.flatMap(p => p.new_risks_identified);

    // --- Blockers formatted ---
    const allBlockersFormatted = projects.flatMap(p =>
        p.blocker_details.map(b =>
            `<li><strong>${b.ticket_key}</strong> by ${b.owner}: ${b.blocker_description} (${b.days_blocked} day(s) blocked)</li>`
        )
    );

    // --- People Utilization ---
    const allPeopleUtilization = projects.map(p => ({
        project_name: p.project_name,
        utilization: p.individual_utilization.map(u => ({
            team_member: u.team_member,
            tickets_worked_on: u.tickets_worked_on,
            story_points_handled: u.story_points_handled,
            utilization_percent: u.utilization_percent
        }))
    }));

    // --- Prepare Data for Member Utilization Chart ---
    const memberLabels = []; // unique team members
    const projectDatasets = projects.map(p => {
        const data = p.individual_utilization.map(u => {
            if (!memberLabels.includes(u.team_member)) memberLabels.push(u.team_member);
            return u.utilization_percent;
        });
        return {
            label: p.project_name,
            data: data,
            backgroundColor: getRandomColor(),
        };
    });

    function getRandomColor() {
        const r = Math.floor(Math.random() * 127 + 127);
        const g = Math.floor(Math.random() * 127 + 127);
        const b = Math.floor(Math.random() * 127 + 127);
        return `rgba(${r},${g},${b},0.7)`;
    }

    // --- Project Overview Charts ---
    const projectNames = JSON.stringify(projects.map((p, i) => p.project_name || `Project ${i + 1}`));
    const projectCompletion = JSON.stringify(projects.map(p => p.completion_percent || 0));
    const projectBlocked = JSON.stringify(projects.map(p => p.blocked_issues_count || 0));
    const projectColors = JSON.stringify(projects.map(p => p.overall_status === 'At Risk' ? '#fca5a5' : '#86efac'));

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
body { font-family:'Inter', sans-serif; background:#f8fafc; padding:20px; zoom:0.85; }
h1 { font-weight:700; font-size:24px; }
.card { border:none; border-radius:16px; box-shadow:0 8px 20px rgba(0,0,0,0.05); page-break-inside: avoid; break-inside: avoid; display:flex; flex-direction:column; }
.kpi-wrapper { display: flex; flex-wrap: nowrap; gap: 10px; align-items: stretch; width: 100%; margin-bottom: 24px; }
.kpi-item { flex: 1; min-width: 0; }
.kpi-card { height: 100%; padding: 12px 8px !important; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.kpi-card h6 { font-size: 10px; color:#64748b; margin-bottom: 6px; text-align: center; word-wrap: break-word; }
.kpi-card h4 { font-weight:700; font-size: 18px; margin: 0; }
.section-title { font-size:14px; font-weight:600; margin-bottom:8px; }
ul { font-size:11px; }
@page { margin: 10mm; }
.page-wrapper { width: 100%; }
.chart-container {
  position: relative;
  height: 300px;   /* give it real height */
  width: 100%;
}
</style>
</head>
<body>
<div class="page-wrapper">
<div class="container-fluid">

<div class="row mb-3">
<div class="col">
<h1>Weekly Manager Report</h1>
<small class="text-muted">
Total Projects: ${portfolio.totalProjects} | Generated: ${formatDate(new Date())}
</small>
</div>
</div>

<div class="kpi-wrapper">
${[
    { label: "Avg Completion", value: portfolio.avgCompletion + "%" },
    { label: "Avg Health Score", value: portfolio.avgHealth },
    { label: "Avg Utilization", value: portfolio.avgUtilization + "%" },
    { label: "Total Blocked Issues", value: portfolio.totalBlocked },
    { label: "Escalations Required", value: escalations },
    { label: "Total Updates", value: totalUpdates },
    { label: "Tickets Completed", value: totalTicketsCompleted },
    { label: "Tickets In Progress", value: totalTicketsInProgress },
    { label: "Story Points Completed", value: totalStoryPoints },
    { label: "Active Team Members", value: totalTeamMembers }
].map(k => `
<div class="kpi-item">
<div class="card kpi-card bg-white">
<h6>${k.label}</h6>
<h4>${k.value}</h4>
</div>
</div>
`).join("")}
</div>

<div class="row g-4 mb-4 align-items-stretch">
<div class="col-8 d-flex">
<div class="card p-3 w-100">
<div class="section-title">Project Completion & Status</div>
<canvas id="statusChart"></canvas>
</div>
</div>

<div class="col-4 d-flex">
<div class="card p-3 w-100">
<div class="chart-container" style="height:350px; width:100%;">
  <canvas id="blockChart"></canvas>
</div>
</div>
</div>

<div class="row g-4 mb-4 align-items-stretch">
<div class="col-12 d-flex">
<div class="card p-3 w-100">
<div class="section-title">Project-wise Ticket Overview</div>
<canvas id="ticketChart" style="max-height: 300px;"></canvas>
</div>
</div>
</div>

<div class="row g-3 align-items-stretch">
<div class="col d-flex">
<div class="card p-3 w-100">
<div class="section-title">Key Accomplishments</div>
<ul>${allAccomplishments.length ? allAccomplishments.map(a => `<li>${a}</li>`).join("") : "<li>None</li>"}</ul>
</div>
</div>

<div class="col d-flex">
<div class="card p-3 w-100">
<div class="section-title">Next Focus</div>
<ul>${allNextFocus.length ? allNextFocus.map(a => `<li>${a}</li>`).join("") : "<li>None</li>"}</ul>
</div>
</div>

<div class="col d-flex">
<div class="card p-3 w-100">
<div class="section-title">Risks & Blockers</div>
<strong>New Risks:</strong>
<ul>${allRisks.length ? allRisks.map(r => `<li>${r}</li>`).join("") : "<li>None</li>"}</ul>
<strong>Blocker Details:</strong>
<ul>${allBlockersFormatted.length ? allBlockersFormatted.join("") : "<li>None</li>"}</ul>
</div>
</div>
</div>

<div class="row g-4 mb-4 mt-4 align-items-stretch">
<div class="col-12 d-flex">
<div class="card p-3 w-100">
<div class="section-title">Team Member Utilization (%)</div>
<canvas id="memberUtilizationChart" style="max-height: 300px;"></canvas>
</div>
</div>
</div>

</div>
</div>

<script>
// --- Project Completion Chart ---
new Chart(document.getElementById('statusChart'), {
    type:'bar',
    data:{ labels: ${projectNames}, datasets:[{ label: 'Completion %', data: ${projectCompletion}, backgroundColor: ${projectColors} }] },
    options:{ plugins:{legend:{display:false}}, scales: { y: { beginAtZero: true, max: 100 } } }
});

// --- Blocked Issues Chart ---
new Chart(document.getElementById('blockChart'), {
    type: 'bar',
    data: {
        labels: ${projectNames},
        datasets: [{ data: ${projectBlocked}, backgroundColor: '#fca5a5' }]
    },
    options: {
        maintainAspectRatio: false, 
        plugins: { legend: { display: false } },
        scales: {
            y: {
                beginAtZero: true,
                max:10,
                ticks: {
                    stepSize: 1,
                    font: { size: 8 }  // increase y-axis tick font size
                },
                title: {
                    display: true,
                    text: 'Blocked Issues',
                    font: { size: 12 }
                }
            },
            x: {
                ticks: {
                    font: { size: 8 },  // increase x-axis tick font size
                    maxRotation: 0,      // no tilt
                    minRotation: 0       // no tilt
                },
                title: {
                    display: true,
                    text: 'Project',
                    font: { size: 12 }
                }
            }
        }
    }
});

// --- Tickets Chart ---
new Chart(document.getElementById('ticketChart'), {
    type: 'bar',
    data: {
        labels: ${projectNames},
        datasets: [
            { label: 'Completed', data: ${projectTicketsCompleted}, backgroundColor: '#34d399' },
            { label: 'In Progress', data: ${projectTicketsInProgress}, backgroundColor: '#fbbf24' },
            { label: 'To Do', data: ${projectTicketsToDo}, backgroundColor: '#60a5fa' }
        ]
    },
    options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
});

// --- Member Utilization Chart ---
new Chart(document.getElementById('memberUtilizationChart'), {
    type: 'bar',
    data: {
        labels: ${JSON.stringify(memberLabels)},
        datasets: ${JSON.stringify(projectDatasets)}
    },
    options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Utilization % per Team Member per Project' } },
        scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Utilization %' } }, x: { title: { display: true, text: 'Team Members' } } }
    }
});
</script>
</body>
</html>
`;

    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => window.Chart);
    await new Promise(resolve => setTimeout(resolve, 1200));

    const contentHeight = await page.evaluate(() => document.documentElement.offsetHeight);
    await page.pdf({
        path: filePath,
        width: "297mm",
        height: contentHeight + 100 + "px",
        printBackground: true
    });

    console.log("PDF generated successfully at:", filePath);
    await browser.close();
    return filePath;
}