const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const credentialsPath = path.resolve(
  process.cwd(),
  process.env.GOOGLE_WALLET_CREDENTIALS,
);

const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

function sanitizeWalletId(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_");
}

function createGoogleWalletUrl(member) {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX;

  if (!issuerId || !classSuffix) {
    throw new Error("Google Wallet configuration is missing");
  }

  const classId = `${issuerId}.${classSuffix}`;
  const safeMemberId = sanitizeWalletId(member.id);
  const objectId = `${issuerId}.healix_member_${safeMemberId}`;

  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",

    cardTitle: {
      defaultValue: {
        language: "en-US",
        value: "Healix",
      },
    },

    header: {
      defaultValue: {
        language: "en-US",
        value: member.name,
      },
    },

    subheader: {
      defaultValue: {
        language: "en-US",
        value: "Healix Membership",
      },
    },

    barcode: {
      type: "QR_CODE",
      value: String(member.id),
      alternateText: "Healix Member",
    },

    textModulesData: [
      {
        id: "membership",
        header: "Membership",
        body: "Present this pass at participating Healix locations.",
      },
    ],
  };

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [],
    payload: {
      genericObjects: [genericObject],
    },
  };

  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: "RS256",
  });

  return {
    objectId,
    saveUrl: `https://pay.google.com/gp/v/save/${token}`,
  };
}

module.exports = {
  createGoogleWalletUrl,
};
