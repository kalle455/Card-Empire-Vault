import { supabase } from "../lib/supabase";

export async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*, banlist:banlists(name, card_names), registrations:event_registrations(count)")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function registerForEvent(eventId, playerId) {
  const { error } = await supabase.from("event_registrations").insert({ event_id: eventId, player_id: playerId });
  if (error) throw error;
}

export async function addFeedback(playerId, message) {
  const { error } = await supabase.from("feedback").insert({ player_id: playerId, message });
  if (error) throw error;
}

export function subscribeToLiveChanges(onChange) {
  return supabase
    .channel("card-empire-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, onChange)
    .subscribe();
}
