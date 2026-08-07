const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const healixDb = require("../healixdb");

const router = express.Router();
const { generateWalletPass } = require("../services/walletPassService");
const { createGoogleWalletUrl } = require("../services/googleWalletService");
const generatePlayerCode = require("../utils/generatePlayerCode");
const bwipjs = require("bwip-js");

async function createUniquePlayerCode(client) {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = Math.floor(1000 + Math.random() * 9000);

    const result = await client.query(
      `
        SELECT id
        FROM public.bingo_players
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
  const client = await db.connect();

  try {
    const { name, email } = req.body;

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    await client.query("BEGIN");

    const existingPlayer = await client.query(
      `
        SELECT id
        FROM public.bingo_players
        WHERE email = $1
      `,
      [normalizedEmail],
    );

    if (existingPlayer.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "That email is already registered.",
      });
    }

    const code = await createUniquePlayerCode(client);

    const playerResult = await client.query(
      `
        INSERT INTO public.bingo_players (
          name,
          email,
          code
        )
        VALUES ($1, $2, $3)
        RETURNING id, name, email, code, created_at
      `,
      [normalizedName, normalizedEmail, code],
    );

    const player = playerResult.rows[0];

    const tasksResult = await client.query(`
      SELECT id
      FROM public.tasks
      ORDER BY RANDOM()
      LIMIT 6
    `);

    if (tasksResult.rowCount < 6) {
      throw new Error("At least 6 tasks are required to create a board");
    }

    for (let index = 0; index < tasksResult.rows.length; index += 1) {
      const task = tasksResult.rows[index];

      await client.query(
        `
          INSERT INTO public.player_board_tasks (
            player_id,
            task_id,
            board_position
          )
          VALUES ($1, $2, $3)
        `,
        [player.id, task.id, index + 1],
      );
    }

    const boardResult = await client.query(
      `
        SELECT
          pbt.id AS player_board_task_id,
          pbt.board_position,
          pbt.is_completed,
          pbt.completed_at,
          t.id AS task_id,
          t.title,
          t.points,
          t.difficulty
        FROM public.player_board_tasks pbt
        JOIN public.tasks t
          ON t.id = pbt.task_id
        WHERE pbt.player_id = $1
        ORDER BY pbt.board_position ASC
      `,
      [player.id],
    );

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

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Player signed up successfully",
      token,
      player,
      board: boardResult.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Player signup error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "That email or player code is already in use",
      });
    }

    return res.status(500).json({
      error: "Something went wrong",
    });
  } finally {
    client.release();
  }
});

router.post("/members/signup", async (req, res) => {
  const client = await healixDb.connect();

  try {
    const { name, city, phone, email, answer, emailOptIn } = req.body;

    if (!name?.trim() || !email?.trim() || !city.trim() || !phone.trim()) {
      return res.status(400).json({
        error: "Name, email, phone, city are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    await client.query("BEGIN");

    let memberResult = await client.query(
      `
        SELECT
          id,
          name,
          city,
          phone,
          email,
          answer,
          email_opt_in,
          created_at,
          updated_at
        FROM members
        WHERE email = $1
      `,
      [normalizedEmail],
    );

    let member;

    if (memberResult.rowCount > 0) {
      member = memberResult.rows[0];
    } else {
      memberResult = await client.query(
        `
          INSERT INTO members (
            name,
            city,
            phone,
            email,
            answer,
            email_opt_in
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id,
            name,
            city,
            phone,
            email,
            answer,
            email_opt_in,
            created_at,
            updated_at
        `,
        [
          name.trim(),
          city?.trim() || null,
          phone?.trim() || null,
          normalizedEmail,
          answer?.trim() || null,
          Boolean(emailOptIn),
        ],
      );

      member = memberResult.rows[0];
    }

    const googleWallet = createGoogleWalletUrl(member);

    await client.query("COMMIT");

    return res.status(200).json({
      message:
        memberResult.rowCount > 0
          ? "Member found"
          : "Member created successfully",
      member,
      wallet: {
        googleUrl: googleWallet.saveUrl,
        appleUrl: `https://api.spearitual.xyz/wallet-pass/${member.id}`,
      },

      barcodeUrl: `https://api.spearitual.xyz/members/${member.id}/barcode`,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Member signup error:", error);

    return res.status(500).json({
      error: "Unable to process member",
    });
  } finally {
    client.release();
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
router.get("/wallet-pass/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;

    const result = await healixDb.query(
      `
        SELECT
          id,
          name,
          city,
          phone,
          email,
          answer,
          email_opt_in
        FROM members
        WHERE id = $1
      `,
      [memberId],
    );

    const member = result.rows[0];

    if (!member) {
      return res.status(404).json({
        error: "Member not found",
      });
    }

    const { buffer, serialNumber } = await generateWalletPass(member);

    console.log("Apple Wallet pass generated:", {
      memberId: member.id,
      serialNumber,
      generatedAt: new Date().toISOString(),
    });

    res.set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": 'attachment; filename="healix-membership.pkpass"',
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });

    return res.send(buffer);
  } catch (error) {
    console.error("Apple Wallet pass error:", error);

    return res.status(500).json({
      error: "Unable to generate Apple Wallet pass",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.get("/members/:memberId/barcode", async (req, res) => {
  try {
    const { memberId } = req.params;

    const result = await healixDb.query(
      `
        SELECT id
        FROM members
        WHERE id = $1
      `,
      [memberId],
    );

    const member = result.rows[0];

    if (!member) {
      return res.status(404).json({
        error: "Member not found",
      });
    }

    const barcode = await bwipjs.toBuffer({
      bcid: "code128",
      text: String(member.id),
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: "center",
    });

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    });

    return res.send(barcode);
  } catch (error) {
    console.error("Barcode error:", error);

    return res.status(500).json({
      error: "Unable to generate barcode",
    });
  }
});

module.exports = router;
