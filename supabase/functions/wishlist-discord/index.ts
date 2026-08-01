import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ accepted: false }, 405);

  let payload: { record?: { id?: string } } = {};
  try { payload = await req.json(); } catch { return json({ accepted: false }, 202); }
  const queueId = payload.record?.id;
  if (!queueId) return json({ accepted: false }, 202);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!supabaseUrl || !serviceRole) return json({ accepted: false }, 202);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: item } = await supabase
    .from("discord_notification_queue")
    .select("id, discord_id, body, status, attempts")
    .eq("id", queueId)
    .maybeSingle();
  if (!item || item.status === "sent") return json({ accepted: true }, 202);

  if (!botToken) {
    await supabase.from("discord_notification_queue").update({
      status: "waiting_configuration",
      last_error: "DISCORD_BOT_TOKEN is not configured.",
      attempts: Number(item.attempts ?? 0) + 1,
    }).eq("id", item.id);
    return json({ accepted: true, configured: false }, 202);
  }

  try {
    const dm = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: item.discord_id }),
    });
    if (!dm.ok) throw new Error(`Discord DM channel failed (${dm.status}).`);
    const channel = await dm.json();

    const message = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**Card Empire · Cardstock Wishlist**\n${item.body}\nhttps://card-empire-vault.vercel.app/marketplace`,
        allowed_mentions: { parse: [] },
      }),
    });
    if (!message.ok) throw new Error(`Discord message failed (${message.status}).`);

    await supabase.from("discord_notification_queue").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
      attempts: Number(item.attempts ?? 0) + 1,
    }).eq("id", item.id);
  } catch (error) {
    await supabase.from("discord_notification_queue").update({
      status: "failed",
      last_error: String(error?.message ?? "Discord delivery failed").slice(0, 500),
      attempts: Number(item.attempts ?? 0) + 1,
    }).eq("id", item.id);
  }

  return json({ accepted: true }, 202);
});
