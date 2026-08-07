const express = require("express");
const db = require("../db");
const healixDb = require("../healixdb");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "JWT Auth API is running",
  });
});

router.get("/db-test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");

    return res.json({
      success: true,
      database: "spearitual",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("DB test error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/healix-db-test", async (req, res) => {
  try {
    const result = await healixDb.query("SELECT NOW()");

    return res.json({
      success: true,
      database: "healix",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Healix DB test error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
