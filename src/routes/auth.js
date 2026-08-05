const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const { generateWalletPass } = require("../services/walletPassService");
const generatePlayerCode = require("../utils/generatePlayerCode");

async function createUniquePlayerCode() {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generatePlayerCode();

    const result = await db.query(
      `
        SELECT id
        FROM bingo_players
        WHERE code = $1
        LIMIT 1
      `,
      [code],
    );

    if (result.rowCount === 0) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique player code");
}
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

router.post("/playerSignUp", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const existingPlayer = await db.query(
      `
      SELECT id
      FROM bingo_players
      WHERE email = $1
      `,
      [email.toLowerCase()],
    );

    if (existingPlayer.rowCount > 0) {
      return res.status(409).json({
        error: "That email is already registered.",
      });
    }

    const code = await createUniquePlayerCode();

    const result = await db.query(
      `
      INSERT INTO bingo_players (name, email, code)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, code, created_at
      `,
      [name, email.toLowerCase(), code],
    );

    const player = result.rows[0];

    const token = jwt.sign(
      {
        sub: player.id,
        email: player.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "3d",
      },
    );

    res.status(201).json({
      message: "Player signed up successfully",
      token,
      player,
    });
  } catch (error) {
    console.error("Player signup error:", error);

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

router.post("/playerLogin", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || code === undefined || code === null) {
      return res.status(400).json({
        error: "Email and code are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = Number(code);

    if (!Number.isInteger(normalizedCode)) {
      return res.status(400).json({
        error: "Code must be a valid number",
      });
    }

    const result = await db.query(
      `
        SELECT id, name, email, code, created_at
        FROM bingo_players
        WHERE email = $1
          AND code = $2
      `,
      [normalizedEmail, normalizedCode],
    );

    const player = result.rows[0];

    if (!player) {
      return res.status(401).json({
        error: "Invalid email or code",
      });
    }

    const token = jwt.sign(
      {
        sub: player.id,
        email: player.email,
        role: "bingo_player",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "3d",
      },
    );

    return res.json({
      message: "Login successful",
      token,
      player,
    });
  } catch (error) {
    console.error("Player login error:", error);

    return res.status(500).json({
      error: "Something went wrong",
    });
  }
});
router.get("/wallet-pass", async (req, res) => {
  try {
    const { buffer, serialNumber } = await generateWalletPass();

    console.log("Test Wallet pass generated:", {
      serialNumber,
      generatedAt: new Date().toISOString(),
    });

    res.set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": 'attachment; filename="test-pass.pkpass"',
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });

    return res.send(buffer);
  } catch (error) {
    console.error("Test Wallet pass error:", error);

    return res.status(500).json({
      error: "Unable to generate test Wallet pass",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
