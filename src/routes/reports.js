const express = require("express");
const router = express.Router();

const { generateReport } = require("../services/reportingService");

router.get("/", async (req, res) => {
  try {
    const report = await generateReport();

    return res.status(200).json(report);
  } catch (error) {
    console.error("Reporting error:", error);

    return res.status(500).json({
      error: "Failed to generate report",
    });
  }
});

module.exports = router;
