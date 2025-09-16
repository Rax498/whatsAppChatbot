const RISTA_TOKEN = process.env.RISTA_TOKEN;
const RISTA_SECURITY_KEY = process.env.RISTA_SECURITY_KEY;

export const TokenGen = () => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = 1200;

  const payload = {
    iss: RISTA_TOKEN,
    iat: issuedAt,
    jti: Date.now().toString(),
    exp: issuedAt + expiresIn + 30,
  };

  const base64url = (source) => {
    return Buffer.from(JSON.stringify(source))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  // Header
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  // Encode header and payload
  const encodedHeader = base64url(header);
  const encodedPayload = base64url(payload);

  // Sign the token using HMAC-SHA256 (Node.js 'crypto')
  const crypto = require("crypto");
  const signature = crypto
    .createHmac("sha256", RISTA_SECURITY_KEY)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Final JWT
  const jwtToken = `${encodedHeader}.${encodedPayload}.${signature}`;
  return jwtToken;
};
