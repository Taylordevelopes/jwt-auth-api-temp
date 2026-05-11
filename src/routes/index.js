const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /
router.get("/", (req, res) => {
  res.json({ message: "JWT Auth API is running" });
});

// GET /db-test
router.get("/db-test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");

    res.json({
      success: true,
      time: result.rows[0],
    });
  } catch (error) {
    console.error("DB test error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
