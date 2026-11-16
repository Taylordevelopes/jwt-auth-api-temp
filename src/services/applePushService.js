const http2 = require("node:http2");
const fs = require("node:fs");
const path = require("node:path");
const healixDb = require("../healixdb");

const PASS_TYPE_ID = process.env.APPLE_WALLET_PASS_TYPE_IDENTIFIER;

const certificate = fs.readFileSync(
  path.join(__dirname, "../../certificates/signerCert.pem"),
);

const privateKey = fs.readFileSync(
  path.join(__dirname, "../../certificates/signerKey.pem"),
);

async function sendWalletPush(memberId) {
  const result = await healixDb.query(
    `
    SELECT DISTINCT wd.push_token
    FROM wallet_devices wd
    JOIN wallet_registrations wr
      ON wr.device_id = wd.id
    JOIN wallet_passes wp
      ON wp.id = wr.pass_id
    WHERE wp.member_id = $1::uuid
      AND wp.pass_type_identifier = $2
    `,
    [memberId, PASS_TYPE_ID],
  );

  if (result.rows.length === 0) {
    console.log("No Apple Wallet devices registered for member:", memberId);
    return;
  }

  for (const device of result.rows) {
    await pushToApple(device.push_token);
  }
}

function pushToApple(pushToken) {
  return new Promise((resolve, reject) => {
    const client = http2.connect("https://api.push.apple.com", {
      cert: certificate,
      key: privateKey,
    });

    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      client.close();

      if (error) reject(error);
      else resolve(result);
    };

    client.on("error", finish);

    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      "apns-topic": PASS_TYPE_ID,
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
    });

    let status;
    let responseBody = "";

    request.on("response", (headers) => {
      status = headers[":status"];
    });

    request.on("data", (chunk) => {
      responseBody += chunk.toString();
    });

    request.on("end", () => {
      if (status === 200) {
        console.log("Apple Wallet push accepted");
        finish(null, { success: true });
      } else {
        finish(new Error(`APNs rejected push: ${status} ${responseBody}`));
      }
    });

    request.on("error", finish);

    request.end("{}");
  });
}

module.exports = { sendWalletPush };
