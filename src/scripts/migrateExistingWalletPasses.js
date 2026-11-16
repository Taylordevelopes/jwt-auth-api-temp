const { healixDb } = require("../db"); // Adjust to your actual DB export
const {
  getOrCreatePassAuthenticationToken,
} = require("../services/walletPassAuthService");

async function migrateExistingWalletPasses() {
  const result = await healixDb.query(`
    SELECT m.id
    FROM members m
    LEFT JOIN wallet_passes wp
      ON wp.member_id = m.id
    WHERE wp.id IS NULL
    ORDER BY m.created_at
  `);

  console.log(`Found ${result.rows.length} members to migrate`);

  let migrated = 0;
  let failed = 0;

  for (const member of result.rows) {
    try {
      await getOrCreatePassAuthenticationToken(member.id);

      migrated++;

      console.log(`Migrated ${migrated}/${result.rows.length}`);
    } catch (error) {
      failed++;
      console.error(`Failed to migrate ${member.id}:`, error.message);
    }
  }

  console.log("Migration complete", {
    migrated,
    failed,
  });

  await healixDb.end();
}

migrateExistingWalletPasses().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
