require("dotenv").config();
const db = require("./db");
const jwt = require("jsonwebtoken");

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();

function createSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "JWT Auth API is running" });
});

app.get("/db-test", async (req, res) => {
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

app.post("/signup", async (req, res) => {
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

app.post("/login", async (req, res) => {
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

app.post("/subscribe", async (req, res) => {
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

app.post("/products", async (req, res) => {
  try {
    const {
      title,
      description,
      image_url,
      site_url,
      download_url,
      featured = false,
    } = req.body;

    if (!title || !description || !image_url) {
      return res.status(400).json({
        error: "title, description, and image_url are required",
      });
    }

    const slug = createSlug(title);

    const result = await db.query(
      `
        INSERT INTO products (
          title,
          slug,
          description,
          image_url,
          site_url,
          download_url,
          featured
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [title, slug, description, image_url, site_url, download_url, featured],
    );

    res.status(201).json({
      message: "Product created successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Create product error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        error: "A product with this slug already exists",
      });
    }

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

app.post("/post-blog", async (req, res) => {
  try {
    const { blogger_id, title, body, published = false } = req.body;

    if (!blogger_id || !title || !body) {
      return res.status(400).json({
        error: "blogger_id, title, and body are required",
      });
    }

    const slug = createSlug(title);

    const result = await db.query(
      `
        INSERT INTO blogs (blogger_id, title, slug, body, published)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, blogger_id, title, slug, body, published, created_at, updated_at
      `,
      [blogger_id, title, slug, body, published],
    );

    res.status(201).json({
      message: "Blog created successfully",
      blog: result.rows[0],
    });
  } catch (error) {
    console.error("Post blog error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        error: "A blog with this slug/title already exists",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        error: "Invalid blogger_id. User does not exist.",
      });
    }

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("Server running");
});
