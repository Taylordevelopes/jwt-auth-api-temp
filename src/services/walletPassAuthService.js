const crypto = require("node:crypto");
const healixDb = require("../healixdb");

const PASS_TYPE_IDENTIFIER = process.env.APPLE_WALLET_PASS_TYPE_IDENTIFIER;

function getEncryptionKey() {
  const hex = process.env.APPLE_WALLET_TOKEN_ENCRYPTION_KEY;

  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error("Invalid Apple Wallet encryption key");
  }

  return Buffer.from(hex, "hex");
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decryptToken(value) {
  const [ivHex, tagHex, encryptedHex] = value.split(":");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

async function getOrCreatePassAuthenticationToken(memberId) {
  if (!PASS_TYPE_IDENTIFIER) {
    throw new Error("Missing Apple Wallet Pass Type ID");
  }

  const existing = await healixDb.query(
    `SELECT authentication_token_encrypted
     FROM wallet_passes
     WHERE member_id = $1`,
    [memberId],
  );

  if (existing.rows.length > 0) {
    const encrypted = existing.rows[0].authentication_token_encrypted;

    if (!encrypted) {
      throw new Error("Existing pass has no encrypted authentication token");
    }

    return decryptToken(encrypted);
  }

  const token = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const encryptedToken = encryptToken(token);

  const result = await healixDb.query(
    `INSERT INTO wallet_passes (
       member_id,
       pass_type_identifier,
       serial_number,
       authentication_token_hash,
       authentication_token_encrypted
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (member_id) DO NOTHING
     RETURNING id`,
    [
      memberId,
      PASS_TYPE_IDENTIFIER,
      String(memberId),
      tokenHash,
      encryptedToken,
    ],
  );

  // Another request may have created the pass concurrently.
  if (result.rows.length === 0) {
    const saved = await healixDb.query(
      `SELECT authentication_token_encrypted
       FROM wallet_passes
       WHERE member_id = $1`,
      [memberId],
    );

    if (!saved.rows[0]?.authentication_token_encrypted) {
      throw new Error("Unable to retrieve pass credentials");
    }

    return decryptToken(saved.rows[0].authentication_token_encrypted);
  }

  return token;
}

module.exports = {
  getOrCreatePassAuthenticationToken,
};
