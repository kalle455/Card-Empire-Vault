import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

async function discordFetch(url: string, init: RequestInit) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt === 2) return response;
    const payload = await response.clone().json().catch(() => ({}));
    const delay = Math.min(2500, Math.max(250, Number(payload.retry_after ?? 1) * 1000));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error("Discord request failed.");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ accepted: false }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!supabaseUrl || !serviceRole) return json({ accepted: false }, 503);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const providedSecret = req.headers.get("x-cardstock-hook-secret") ?? "";
  const { data: storedSecret } = await supabase
    .from("integration_secrets")
    .select("secret")
    .eq("name", "wishlist_webhook")
    .maybeSingle();
  if (!storedSecret?.secret || !safeEqual(providedSecret, storedSecret.secret)) {
    return json({ accepted: false }, 401);
  }

  let payload: { queue_id?: string; record?: { id?: string } } = {};
  try { payload = await req.json(); } catch { return json({ accepted: false }, 400); }
  const queueId = payload.queue_id ?? payload.record?.id;
  if (!queueId) return json({ accepted: false }, 400);

  const { data: pendingItem } = await supabase
    .from("discord_notification_queue")
    .select("id, discord_id, body, status, attempts, event_type")
    .eq("id", queueId)
    .maybeSingle();
  if (!pendingItem || ["sent", "processing"].includes(pendingItem.status)) return json({ accepted: true }, 202);
  if (Number(pendingItem.attempts ?? 0) >= 5) return json({ accepted: true, exhausted: true }, 202);

  const nextAttempts = pendingItem.status === "waiting_configuration"
    ? Number(pendingItem.attempts ?? 0)
    : Number(pendingItem.attempts ?? 0) + 1;
  const { data: item } = await supabase
    .from("discord_notification_queue")
    .update({ status: "processing", attempts: nextAttempts, last_error: null })
    .eq("id", pendingItem.id)
    .eq("status", pendingItem.status)
    .select("id, discord_id, body, status, attempts, event_type")
    .maybeSingle();
  if (!item) return json({ accepted: true }, 202);

  if (!botToken) {
    await supabase.from("discord_notification_queue").update({
      status: "waiting_configuration",
      last_error: "DISCORD_BOT_TOKEN is not configured.",
    }).eq("id", item.id);
    return json({ accepted: true, configured: false }, 202);
  }

  try {
    const dm = await discordFetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: item.discord_id }),
    });
    if (!dm.ok) throw new Error(`Discord DM channel failed (${dm.status}).`);
    const channel = await dm.json();

    const colors: Record<string, number> = { available: 0x65d982, available_again: 0x65d982, sold: 0xd66868 };
    const titles: Record<string, string> = { available: "A wished card is available", available_again: "A wished card is back", sold: "A wished card was sold" };
    const message = await discordFetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: titles[item.event_type] ?? "Cardstock Wishlist update",
          description: item.body,
          url: "https://card-empire-vault.vercel.app/marketplace",
          color: colors[item.event_type] ?? 0x65d982,
          footer: { text: "Kalenski Card Empire - Cardstock Wishlist" },
        }],
        allowed_mentions: { parse: [] },
      }),
    });
    if (!message.ok) throw new Error(`Discord message failed (${message.status}).`);

    await supabase.from("discord_notification_queue").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", item.id);
  } catch (error) {
    await supabase.from("discord_notification_queue").update({
      status: "failed",
      last_error: String(error?.message ?? "Discord delivery failed").slice(0, 500),
    }).eq("id", item.id);
  }

  return json({ accepted: true }, 202);
});

