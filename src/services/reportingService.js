const healixDb = require("../healixdb");

async function getMonthlySignups() {
  const { rows } = await healixDb.query(`
    SELECT *
    FROM report_monthly_signups
    ORDER BY month DESC
  `);

  return rows;
}

async function getMonthlyEncounters() {
  const { rows } = await healixDb.query(`
    SELECT *
    FROM report_monthly_encounters
    ORDER BY month DESC, total_checkins DESC
  `);

  return rows;
}

async function getEncounterFollowups() {
  const { rows } = await healixDb.query(`
    SELECT *
    FROM report_encounter_followups
    ORDER BY returning_members DESC
  `);

  return rows;
}

async function getEncounterConversion() {
  const { rows } = await healixDb.query(`
    SELECT *
    FROM report_encounter_conversion
    ORDER BY conversion_percentage DESC
  `);

  return rows;
}

async function generateReport() {
  const [signups, encounters, followups, conversion] = await Promise.all([
    getMonthlySignups(),
    getMonthlyEncounters(),
    getEncounterFollowups(),
    getEncounterConversion(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    signups,
    encounters,
    followups,
    conversion,
  };
}

module.exports = {
  getMonthlySignups,
  getMonthlyEncounters,
  getEncounterFollowups,
  getEncounterConversion,
  generateReport,
};
