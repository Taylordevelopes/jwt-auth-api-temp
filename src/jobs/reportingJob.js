require("dotenv").config();

const { publishReport } = require("../services/googleSheetsService");

async function runReportingJob() {
  try {
    console.log(`[${new Date().toISOString()}] Starting Healix reporting job`);

    await publishReport();

    console.log("Healix reporting job completed successfully");

    process.exit(0);
  } catch (error) {
    console.error("Healix reporting job failed:", error.message);

    process.exit(1);
  }
}

runReportingJob();
