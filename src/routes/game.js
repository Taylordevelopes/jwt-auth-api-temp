const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/playerBoard", requireAuth, async (req, res) => {
  try {
    const playerId = req.user.sub;

    const result = await db.query(
      `
      SELECT
        pbt.id,
        pbt.board_position,
        pbt.is_completed,
        pbt.completed_at,

        t.id AS task_id,
        t.title,
        t.points,
        t.difficulty

      FROM player_board_tasks pbt
      JOIN tasks t
        ON pbt.task_id = t.id

      WHERE pbt.player_id = $1

      ORDER BY pbt.board_position;
      `,
      [playerId],
    );

    res.json({
      board: result.rows,
    });
  } catch (error) {
    console.error("Get player board error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
