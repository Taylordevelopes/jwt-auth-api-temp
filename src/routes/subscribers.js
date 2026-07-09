const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const result = await db.query(
      `
        INSERT INTO subscribers (email)
        VALUES ($1)
        RETURNING id, email, subscribed_at
      `,
      [email],
    );

    res.status(201).json({
      message: "Subscribed successfully",
      subscriber: result.rows[0],
    });
  } catch (error) {
    console.error("Subscribe error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        error: "Email already subscribed",
      });
    }

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

router.post("/runclubsubscribe", async (req, res) => {
  try {
    const { email, fullName, age, RunnerStatus } = req.body;

    if (!email || !fullName || !age || !RunnerStatus) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    const result = await db.query(
      `
        INSERT INTO run_club_signups (fullName , email, age, RunnerStatus)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, age, RunnerStatus
      `,
      [fullName, email, age, RunnerStatus],
    );

    res.status(201).json({
      message: "Subscribed to Run Club successfully",
      subscriber: result.rows[0],
    });
  } catch (error) {
    console.error("Run Club Subscribe error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        error: "Email already subscribed to Run Club",
      });
    }

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
