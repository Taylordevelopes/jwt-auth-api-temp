const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /events
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM acw_events
      ORDER BY created_at DESC
    `);

    res.json({
      events: result.rows,
    });
  } catch (error) {
    console.error("Get events error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
