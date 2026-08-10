const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { PKPass } = require("passkit-generator");

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPassLocations() {
  return [
    {
      latitude: 33.752368,
      longitude: -84.395053,
      relevantText:
        "Sidequest BRUNCH Roulette ☕: I order for you. You order for me. Let’s Bottle Rocket.",
    },
    {
      latitude: 33.748428,
      longitude: -84.403898,
      relevantText:
        "Sidequest HEALIX WALK 🌳: Invite a person you vibe with for a walk around the RICE Center. Get to know one another along the way.",
    },

    {
      latitude: 33.7520468,
      longitude: -84.3928773,
      relevantText:
        "Sidequest JUNGLE KIDS🎨: Write a warm message to a child struggling with housing stability in Atlanta’s school system.  Text (404) 693 0823.",
    },
    {
      latitude: 33.7509941,
      longitude: -84.3934862,
      relevantText:
        "COFFEE CULTURE👋🏽 Sidequest: Find or meet a friend from a different culture. Talk about ceremonious food and drinks. Play nice. ",
    },
    {
      latitude: 33.8485001,
      longitude: -84.3735805,
      relevantText:
        "Sidequest WHITE FERRARI🌃 : Find a shiny new friend or two. Seal your connection with evening plans.  We’ll send you two addresses. Pick one. On the drive, nostalgia music only.  ",
    },
    {
      latitude: 33.9667989,
      longitude: -84.218902,
      relevantText:
        "Sidequest BINGO BABY👶🏽: Easy start. Play one row of Sticker Run Bingo. Welcome to GEORGIA. ",
    },
    {
      latitude: 33.7364586,
      longitude: -84.4103058,
      relevantText:
        "Sidequest FIND NI-KA🎨:Ni-ka is a healing-artist with 20 tickets to a private play and dinner. Find her. Get yours.",
    },
    {
      latitude: 33.7364586,
      longitude: -84.4103058,
      relevantText:
        "Sidequest FIND NI-KA🎨:Ni-ka is a healing-artist with 20 tickets to a private play and dinner. Find her. Get yours.",
    },
    {
      latitude: 33.760979,
      longitude: -84.389771,
      relevantText:
        "BINGO BABY 👶🏽 One row. Easy start. Link coming via text. Welcome to GEORGIA.",
    },
    {
      latitude: 33.777161,
      longitude: -84.407867,
      relevantText:
        "WHITE FERRARI (Extended) 🌃You made it! Slow the night down. Share your passions from when you were  16-18yo. Catch a nostalgic vibe together.",
    },
  ];
}
async function generateWalletPass(member) {
  const passModelPath = path.join(
    process.cwd(),
    "wallet",
    "HealixMembership.pass",
  );

  const certificatesPath = path.join(process.cwd(), "certificates");

  const [wwdr, signerCert, signerKey] = await Promise.all([
    fs.readFile(path.join(certificatesPath, "wwdr.pem")),
    fs.readFile(path.join(certificatesPath, "signerCert.pem")),
    fs.readFile(path.join(certificatesPath, "signerKey.pem")),
  ]);

  const locations = getPassLocations();

  const serialNumber = String(member.id);

  const pass = await PKPass.from(
    {
      model: passModelPath,
      certificates: {
        wwdr,
        signerCert,
        signerKey,
      },
    },
    {
      serialNumber,
    },
  );

  pass.primaryFields.push({
    key: "status",
    label: "HEALIX STATUS",
    value: "Active",
  });

  pass.secondaryFields.push({
    key: "points",
    label: "ENCOUNTER POINTS",
    value: "0",
  });

  pass.auxiliaryFields.push({
    key: "name",
    label: "NAME",
    value: member.name,
  });

  pass.auxiliaryFields.push({
    key: "membership",
    label: "DESIGNATION",
    value: "ENROLLED",
  });

  pass.setBarcodes({
    format: "PKBarcodeFormatCode128",
    message: String(member.id),
    messageEncoding: "iso-8859-1",
    altText: member.id.slice(0, 32).toUpperCase(),
  });

  pass.setLocations(...locations);

  return {
    buffer: pass.getAsBuffer(),
    serialNumber,
  };
}

module.exports = {
  generateWalletPass,
};
