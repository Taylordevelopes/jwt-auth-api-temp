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
      latitude: 33.737659,
      longitude: -84.422173,
      relevantText: "HEALIX at The Wren's Nest",
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
