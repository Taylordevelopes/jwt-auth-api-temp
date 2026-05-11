const express = require("express");
const db = require("../db");
const createSlug = require("../utils/createSlug");

const router = express.Router();

// GET /products
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM products
      ORDER BY created_at DESC
    `);

    res.json({
      products: result.rows,
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// GET /products/:slug
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await db.query(
      `
        SELECT *
        FROM products
        WHERE slug = $1
      `,
      [slug],
    );

    const product = result.rows[0];

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    res.json({
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// POST /products
router.post("/", async (req, res) => {
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

module.exports = router;
