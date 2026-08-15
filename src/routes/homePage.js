const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/homeImageSlide", requireAuth, async (req, res) => {
  try {
    const {
      image_data,
      mime_type,
      file_name,
      title,
      description,
      is_active,
      display_order,
    } = req.body;

    if (!image_data || !mime_type || !file_name || !title) {
      return res.status(400).json({
        error: "there are missing feilds",
      });
    }

    const result = await db.query(
      `   INSERT into hero_images(
            image_data,
            mime_type,
            file_name,
            title,
            description,
            is_active,
            display_order
            )
            VALUES($1,$2,$3,$4,$5,$6,$7)
            `,
      [
        image_data,
        mime_type,
        file_name,
        title,
        description,
        is_active,
        display_order,
      ],
    );

    res.status(201).json({
      message: "Hero Image added successfully",
      image: result.rows[0],
    });
  } catch (error) {
    console.error("Image upload", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
