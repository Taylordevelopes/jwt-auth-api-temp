const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const router = express.Router();

const credentialsPath = path.resolve(
  process.cwd(),
  process.env.GOOGLE_WALLET_CREDENTIALS,
);

const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

router.get("/google-wallet-pass", async (req, res) => {
  try {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX;

    if (!issuerId || !classSuffix) {
      return res.status(500).json({
        error: "Google Wallet configuration is missing",
      });
    }

    const classId = `${issuerId}.${classSuffix}`;

    // Must be unique for every individual pass.
    const objectSuffix = `healix_style_test_${Date.now()}`;
    const objectId = `${issuerId}.${objectSuffix}`;

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
          value: "Taylor Spear",
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
        value: objectId,
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

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return res.status(200).json({
      message: "Google Wallet link generated",
      classId,
      objectId,
      saveUrl,
    });
  } catch (error) {
    console.error("Google Wallet error:", error);

    return res.status(500).json({
      error: "Unable to generate Google Wallet pass",
    });
  }
});

module.exports = router;
