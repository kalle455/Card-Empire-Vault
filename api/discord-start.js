import { createHmac, randomBytes } from "node:crypto";

const FALLBACK_SUPABASE_URL = "https://ewpqnrhhrqvlywmdbral.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_1TfSf_SXnqVROAidTGvuIQ_5qo7xIPt";
const FALLBACK_APP_URL = "https://card-empire-vault.vercel.app";

function encodeCookie(payload, secret) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST requests are supported." });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
  const appUrl = (process.env.APP_URL || FALLBACK_APP_URL).replace(/\/$/, "");

  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: "Discord login is not configured on Vercel yet." });
  }

  const authorization = String(req.headers.authorization || "");
  let player = null;
  if (authorization.startsWith("Bearer ")) {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    if (!userResponse.ok) return res.status(401).json({ error: "Player session is invalid or expired." });
    player = await userResponse.json();
    if (!player?.id) return res.status(401).json({ error: "Player session could not be verified." });
  }

  const state = randomBytes(32).toString("base64url");
  const cookie = encodeCookie({
    state,
    playerId: player?.id ?? null,
    playerWasAnonymous: Boolean(player?.is_anonymous),
    expiresAt: Date.now() + 10 * 60 * 1000,
  }, clientSecret);
  res.setHeader("Set-Cookie", `discord_oauth=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/api/discord-callback; Max-Age=600`);

  const redirectUri = `${appUrl}/api/discord-callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "consent");

  return res.status(200).json({ url: authorize.toString() });
}

