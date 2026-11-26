const { generateReport } = require("./reportingService");

async function publishReport() {
  const url = process.env.HEALIX_REPORTING_URL;
  const secret = process.env.HEALIX_REPORTING_SECRET;

  if (!url || !secret) {
    throw new Error("Missing reporting environment variables");
  }

  const report = await generateReport();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret,
      report,
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets HTTP error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Failed to publish report");
  }

  console.log("Healix report published successfully:", result);

  return result;
}

module.exports = {
  publishReport,
};
