import { createDecipheriv, createHash } from "node:crypto";

function readCookie(req, name) {
  const match = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function decryptSession(value, secret) {
  const [ivValue, tagValue, encryptedValue] = String(value).split(".");
  if (!ivValue || !tagValue || !encryptedValue) return null;
  try {
    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", "discord_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/discord-session; Max-Age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST requests are supported." });
  }

  const secret = process.env.DISCORD_CLIENT_SECRET;
  if (!secret) return res.status(503).json({ error: "Discord session is not configured." });
  const session = decryptSession(readCookie(req, "discord_session"), secret);
  if (!session || session.expiresAt < Date.now() || !session.access_token || !session.refresh_token) {
    return res.status(401).json({ error: "Discord session expired. Please try again." });
  }

  return res.status(200).json({ access_token: session.access_token, refresh_token: session.refresh_token });
}

