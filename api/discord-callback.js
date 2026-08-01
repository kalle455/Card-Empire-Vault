import { createHmac, timingSafeEqual } from "node:crypto";

const FALLBACK_SUPABASE_URL = "https://ewpqnrhhrqvlywmdbral.supabase.co";
const FALLBACK_APP_URL = "https://card-empire-vault.vercel.app";

function readCookie(req, name) {
  const match = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function decodeCookie(cookie, secret) {
  const [value, signature] = String(cookie).split(".");
  if (!value || !signature) return null;
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function safeUsername(value, discordId) {
  const original = String(value || "DiscordPlayer").trim().slice(0, 30);
  if (original.length >= 3) return original;
  return `Player_${String(discordId).slice(-6)}`;
}

function redirect(res, appUrl, error = "") {
  res.setHeader("Set-Cookie", "discord_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api/discord-callback; Max-Age=0");
  const destination = new URL("/profile", appUrl);
  if (error) destination.searchParams.set("discord_error", error);
  else destination.searchParams.set("discord", "connected");
  res.statusCode = 302;
  res.setHeader("Location", destination.toString());
  res.end();
}

async function findProfile(supabaseUrl, serviceRole, field, value) {
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("select", "id");
  url.searchParams.set(field, `eq.${value}`);
  const response = await fetch(url, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  });
  if (!response.ok) throw new Error("Profile lookup failed.");
  return (await response.json())[0] ?? null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const appUrl = (process.env.APP_URL || FALLBACK_APP_URL).replace(/\/$/, "");
  if (req.method !== "GET") return redirect(res, appUrl, "Invalid Discord callback.");

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  if (!clientId || !clientSecret || !serviceRole) return redirect(res, appUrl, "Discord login is not fully configured on Vercel.");

  const oauth = decodeCookie(readCookie(req, "discord_oauth"), clientSecret);
  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  if (!oauth || oauth.expiresAt < Date.now() || oauth.state !== state || !code) {
    return redirect(res, appUrl, "Discord login expired. Please try again.");
  }

  const redirectUri = `${appUrl}/api/discord-callback`;
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResponse.ok) return redirect(res, appUrl, "Discord did not accept the login.");

  const token = await tokenResponse.json();
  const discordResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!discordResponse.ok) return redirect(res, appUrl, "Discord identity could not be verified.");

  const discord = await discordResponse.json();
  if (!discord?.id || !discord?.username) return redirect(res, appUrl, "Discord returned an incomplete identity.");

  try {
    const linked = await findProfile(supabaseUrl, serviceRole, "discord_id", discord.id);
    if (linked && linked.id !== oauth.playerId) {
      return redirect(res, appUrl, "This Discord account is already linked to another player.");
    }

    let username = safeUsername(discord.username, discord.id);
    const usernameOwner = await findProfile(supabaseUrl, serviceRole, "username", username);
    if (usernameOwner && usernameOwner.id !== oauth.playerId) {
      username = `${username.slice(0, 25)}_${String(discord.id).slice(-4)}`;
    }

    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: oauth.playerId,
        username,
        discord_id: String(discord.id),
        discord_connected_at: new Date().toISOString(),
      }),
    });
    if (!profileResponse.ok) throw new Error("Profile update failed.");
  } catch {
    return redirect(res, appUrl, "Your Card Empire profile could not be linked.");
  }

  return redirect(res, appUrl);
}
