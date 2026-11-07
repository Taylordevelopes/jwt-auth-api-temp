const express = require("express");
const crypto = require("node:crypto");
const healixDb = require("../healixdb");

const router = express.Router();

router.post(
  "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber",
  async (req, res) => {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
      req.params;

    const { pushToken } = req.body || {};

    const authorization = req.get("Authorization") || "";

    // Apple sends: Authorization: ApplePass <token>
    const match = /^ApplePass ([^\s]+)$/.exec(authorization);

    if (!match) {
      return res.sendStatus(401);
    }

    const authenticationToken = match[1];

    if (
      !deviceLibraryIdentifier ||
      !passTypeIdentifier ||
      !serialNumber ||
      typeof pushToken !== "string" ||
      !pushToken.trim()
    ) {
      return res.sendStatus(400);
    }

    let client;

    try {
      client = await healixDb.connect();

      // 1. Find the issued pass.
      const passResult = await client.query(
        `
        SELECT id, authentication_token_hash
        FROM wallet_passes
        WHERE pass_type_identifier = $1
          AND serial_number = $2
        `,
        [passTypeIdentifier, serialNumber],
      );

      const pass = passResult.rows[0];

      if (!pass) {
        return res.sendStatus(404);
      }

      // 2. Authenticate Apple's request.
      const incomingHash = crypto
        .createHash("sha256")
        .update(authenticationToken)
        .digest();

      const storedHash = Buffer.from(pass.authentication_token_hash, "hex");

      if (
        incomingHash.length !== storedHash.length ||
        !crypto.timingSafeEqual(incomingHash, storedHash)
      ) {
        return res.sendStatus(401);
      }

      await client.query("BEGIN");

      // 3. Create or update the Apple device.
      const deviceResult = await client.query(
        `
        INSERT INTO wallet_devices (
          device_library_identifier,
          push_token
        )
        VALUES ($1, $2)
        ON CONFLICT (device_library_identifier)
        DO UPDATE SET
          push_token = EXCLUDED.push_token,
          updated_at = NOW()
        RETURNING id
        `,
        [deviceLibraryIdentifier, pushToken],
      );

      const deviceId = deviceResult.rows[0].id;

      // 4. Register this device for this pass.
      const registrationResult = await client.query(
        `
        INSERT INTO wallet_registrations (
          device_id,
          pass_id
        )
        VALUES ($1, $2)
        ON CONFLICT (device_id, pass_id)
        DO NOTHING
        RETURNING id
        `,
        [deviceId, pass.id],
      );

      await client.query("COMMIT");

      const isNewRegistration = registrationResult.rowCount > 0;

      console.log("Apple Wallet registration:", {
        deviceId,
        passId: pass.id,
        isNewRegistration,
      });

      return res.sendStatus(isNewRegistration ? 201 : 200);
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Wallet registration rollback error:", rollbackError);
        }
      }

      console.error("Apple Wallet registration error:", error);

      return res.sendStatus(500);
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

module.exports = router;
