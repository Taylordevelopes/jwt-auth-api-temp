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
      is_phone_app = false,
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
          featured,
          is_phone_app
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        title,
        slug,
        description,
        image_url,
        site_url,
        download_url,
        featured,
        is_phone_app,
      ],
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

// PUT /products/:slug
router.put("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      title,
      description,
      image_url,
      site_url,
      download_url,
      featured,
      is_phone_app,
    } = req.body;

    // Check if product exists
    const checkResult = await db.query(
      `
        SELECT id FROM products WHERE slug = $1
      `,
      [slug],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;

      // Update slug if title changes
      updates.push(`slug = $${paramCount}`);
      values.push(createSlug(title));
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount}`);
      values.push(image_url);
      paramCount++;
    }

    if (site_url !== undefined) {
      updates.push(`site_url = $${paramCount}`);
      values.push(site_url);
      paramCount++;
    }

    if (download_url !== undefined) {
      updates.push(`download_url = $${paramCount}`);
      values.push(download_url);
      paramCount++;
    }

    if (featured !== undefined) {
      updates.push(`featured = $${paramCount}`);
      values.push(featured);
      paramCount++;
    }

    if (is_phone_app !== undefined) {
      updates.push(`is_phone_app = $${paramCount}`);
      values.push(is_phone_app);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No fields to update",
      });
    }

    // Add updated_at timestamp
    updates.push(`updated_at = NOW()`);

    // Add slug to values for WHERE clause
    values.push(slug);

    const result = await db.query(
      `
        UPDATE products
        SET ${updates.join(", ")}
        WHERE slug = $${paramCount}
        RETURNING *
      `,
      values,
    );

    res.json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error);

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

// DELETE /products/:slug
router.delete("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if product exists
    const checkResult = await db.query(
      `
        SELECT id FROM products WHERE slug = $1
      `,
      [slug],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    // Delete the product
    await db.query(
      `
        DELETE FROM products WHERE slug = $1
      `,
      [slug],
    );

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
