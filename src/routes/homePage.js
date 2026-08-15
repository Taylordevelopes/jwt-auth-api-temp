const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post(
  "/homeImageSlide",
  requireAuth,
  upload.single("image_data"),
  async (req, res) => {
    try {
      const {
        mime_type,
        file_name,
        title,
        description,
        is_active,
        display_order,
      } = req.body;

      if (!req.file || !mime_type || !file_name || !title) {
        return res.status(400).json({
          error: "There are missing fields",
        });
      }

      const imageData = req.file.buffer;

      const result = await db.query(
        `
          INSERT INTO hero_images (
            image_data,
            mime_type,
            file_name,
            title,
            description,
            is_active,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          imageData,
          mime_type,
          file_name,
          title,
          description,
          is_active === "true",
          Number(display_order),
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
  },
);
module.exports = router;
