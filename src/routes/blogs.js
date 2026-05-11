const express = require("express");
const db = require("../db");
const createSlug = require("../utils/createSlug");

const router = express.Router();

// GET /blogs
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM blogs
      ORDER BY created_at DESC
    `);

    res.json({
      blogs: result.rows,
    });
  } catch (error) {
    console.error("Get blogs error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// GET /blogs/:slug
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await db.query(
      `
        SELECT *
        FROM blogs
        WHERE slug = $1
      `,
      [slug],
    );

    const blog = result.rows[0];

    if (!blog) {
      return res.status(404).json({
        error: "Blog not found",
      });
    }

    res.json({
      blog,
    });
  } catch (error) {
    console.error("Get blog error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// POST /post-blog
router.post("/post-blog", async (req, res) => {
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

module.exports = router;
