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

function getLocationCoordinates() {
  const latitude = Number(getRequiredEnv("PASS_LOCATION_LATITUDE"));
  const longitude = Number(getRequiredEnv("PASS_LOCATION_LONGITUDE"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(
      "PASS_LOCATION_LATITUDE and PASS_LOCATION_LONGITUDE must be valid numbers",
    );
  }

  return {
    latitude,
    longitude,
  };
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

  const { latitude, longitude } = getLocationCoordinates();

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

  pass.setLocations({
    latitude,
    longitude,
    relevantText:
      process.env.PASS_LOCATION_MESSAGE || "Your Healix location is nearby",
  });

  return {
    buffer: pass.getAsBuffer(),
    serialNumber,
  };
}

module.exports = {
  generateWalletPass,
};
