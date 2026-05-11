const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

// POST /signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, created_at
      `,
      [email, passwordHash],
    );

    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const result = await db.query(
      `
        SELECT id, email, password_hash, created_at
        FROM users
        WHERE email = $1
      `,
      [email],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
