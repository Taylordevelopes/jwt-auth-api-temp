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

module.exports = router;
