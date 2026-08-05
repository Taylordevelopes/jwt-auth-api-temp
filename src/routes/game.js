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

router.patch(
  "/playerBoard/:playerBoardTaskId",
  requireAuth,
  async (req, res) => {
    try {
      const playerId = req.user.sub;
      const { playerBoardTaskId } = req.params;
      const { isCompleted } = req.body;

      if (typeof isCompleted !== "boolean") {
        return res.status(400).json({
          error: "isCompleted must be true or false",
        });
      }

      const result = await db.query(
        `
          UPDATE public.player_board_tasks
          SET
            is_completed = $1,
            completed_at = CASE
              WHEN $1 = true THEN NOW()
              ELSE NULL
            END
          WHERE id = $2
            AND player_id = $3
          RETURNING
            id AS player_board_task_id,
            task_id,
            board_position,
            is_completed,
            completed_at
        `,
        [isCompleted, playerBoardTaskId, playerId],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Board task not found",
        });
      }

      return res.status(200).json({
        message: isCompleted ? "Task completed" : "Task marked incomplete",
        boardTask: result.rows[0],
      });
    } catch (error) {
      console.error("Update board task error:", error);

      return res.status(500).json({
        error: "Something went wrong",
      });
    }
  },
);

router.post("/playerBoard/new", requireAuth, async (req, res) => {
  const client = await db.connect();

  try {
    const playerId = req.user.sub;

    await client.query("BEGIN");

    // Remove the player's current card
    await client.query(
      `
        DELETE FROM public.player_board_tasks
        WHERE player_id = $1
      `,
      [playerId],
    );

    // Select six new random tasks
    const tasksResult = await client.query(`
      SELECT id
      FROM public.tasks
      ORDER BY RANDOM()
      LIMIT 6
    `);

    if (tasksResult.rowCount < 6) {
      throw new Error("At least 6 tasks are required to create a board");
    }

    // Assign the six tasks to the player
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
        [playerId, task.id, index + 1],
      );
    }

    // Return the newly created card
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
        ORDER BY pbt.board_position
      `,
      [playerId],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "New card created",
      board: boardResult.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create new card error:", error);

    return res.status(500).json({
      error: "Unable to create a new card",
    });
  } finally {
    client.release();
  }
});

router.post("/submitScore", requireAuth, async (req, res) => {
  try {
    const playerId = req.user.sub;

    // Calculate the player's score from completed tasks
    const scoreResult = await db.query(
      `
      SELECT
        COALESCE(SUM(t.points), 0) AS final_score
      FROM player_board_tasks pbt
      JOIN tasks t
        ON pbt.task_id = t.id
      WHERE
        pbt.player_id = $1
        AND pbt.is_completed = true
      `,
      [playerId],
    );

    const finalScore = Number(scoreResult.rows[0].final_score);

    // Save their final score
    const result = await db.query(
      `
      UPDATE bingo_players
      SET
        final_score = $1,
        submitted_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        name,
        email,
        final_score,
        submitted_at
      `,
      [finalScore, playerId],
    );

    res.status(200).json({
      message: "Score submitted successfully!",
      player: result.rows[0],
    });
  } catch (error) {
    console.error("Submit score error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
