import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./AdminDashboard.css";

const blankCard = { name: "", price: "", quantity: "1", category: "monster", rarity: "rare" };
const roles = ["customer", "regular_customer", "trusted_trader", "vip", "potm", "admin"];

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("cards");
  const [data, setData] = useState({ cards: [], events: [], offers: [], feedback: [], players: [] });
  const [card, setCard] = useState(blankCard);
  const [event, setEvent] = useState({ title: "", starts_at: "", description: "" });
  const [notice, setNotice] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  async function load() {
    const [cards, events, offers, feedback, players] = await Promise.all([
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("starts_at"),
      supabase.from("offers").select("*, player:profiles(username)").order("created_at", { ascending: false }),
      supabase.from("feedback").select("*, player:profiles(username)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("username"),
    ]);
    setData({ cards: cards.data ?? [], events: events.data ?? [], offers: offers.data ?? [], feedback: feedback.data ?? [], players: players.data ?? [] });
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const term = card.name.trim();
    if (term.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      const result = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=" + encodeURIComponent(term)).then((response) => response.ok ? response.json() : null).catch(() => null);
      setSuggestions(result?.data?.slice(0, 6) ?? []);
    }, 240);
    return () => clearTimeout(timer);
  }, [card.name]);

  if (profile?.role !== "admin") return <section className="admin-shell"><p className="vault-overline">RESTRICTED AREA</p><h1>Admin access only.</h1><p>Sign in with Kalenski’s administrator account to manage the Empire.</p></section>;

  async function addCard(e) {
    e.preventDefault(); setNotice("Searching YGOPRODeck for the card image…");
    const lookup = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + encodeURIComponent(card.name)).then((r) => r.ok ? r.json() : null).catch(() => null);
    const found = lookup?.data?.[0];
    const { error } = await supabase.from("cards").insert({ name: card.name, price: Number(card.price), quantity: Number(card.quantity), category: card.category, rarity: card.rarity, ygo_card_id: found?.id ?? null, image_url: found?.card_images?.[0]?.image_url ?? null, description: found?.desc ?? "" });
    if (error) return setNotice(error.message);
    setNotice(card.name + " was added to the Vault."); setCard(blankCard); load();
  }
  async function addEvent(e) {
    e.preventDefault();
    const { error } = await supabase.from("events").insert({ ...event, created_by: profile.id });
    if (error) return setNotice(error.message);
    setNotice("Event created and players were notified."); setEvent({ title: "", starts_at: "", description: "" }); load();
  }
  async function setOffer(id, status) {
    const { error } = await supabase.from("offers").update({ status }).eq("id", id);
    setNotice(error ? error.message : "Offer " + status + "."); load();
  }
  async function approveFeedback(id, approved) {
    const { error } = await supabase.from("feedback").update({ approved }).eq("id", id);
    setNotice(error ? error.message : approved ? "Feedback approved." : "Feedback hidden."); load();
  }
  async function setRole(id, role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setNotice(error ? error.message : "Player role updated."); load();
  }

  return <main className="admin-shell"><header><div><p className="vault-overline">KALENSKI™ CONTROL ROOM</p><h1>Empire Admin</h1></div><span>Live system</span></header>
    <nav className="admin-tabs">{["cards","events","offers","feedback","players"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>{notice && <p className="admin-notice">{notice}</p>}
    {tab === "cards" && <section className="admin-grid"><form className="admin-panel" onSubmit={addCard}><h2>Add a card</h2><p>Enter only the card name — the official image and details are found automatically.</p><div className="card-name-field"><input required autoComplete="off" placeholder="Start typing a card name (e.g. PO)" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })}/>{suggestions.length > 0 && <div className="card-suggestions">{suggestions.map((item) => <button type="button" key={item.id} onClick={() => { setCard({ ...card, name: item.name }); setSuggestions([]); }}><img src={item.card_images?.[0]?.image_url_small} alt="" /><span>{item.name}<small>{item.type}</small></span></button>)}</div>}</div><div className="admin-row"><input required type="number" min="0" placeholder="Price in Gold" value={card.price} onChange={(e) => setCard({ ...card, price: e.target.value })}/><input required type="number" min="0" placeholder="Quantity" value={card.quantity} onChange={(e) => setCard({ ...card, quantity: e.target.value })}/></div><div className="admin-row"><select value={card.category} onChange={(e) => setCard({ ...card, category: e.target.value })}><option value="monster">Monster</option><option value="spell">Spell</option><option value="trap">Trap</option></select><select value={card.rarity} onChange={(e) => setCard({ ...card, rarity: e.target.value })}><option value="common">Common</option><option value="rare">Rare</option><option value="gold">Gold</option><option value="rainbow">Rainbow</option></select></div><button className="vault-submit">Add to vault</button></form><section className="admin-panel"><h2>Vault stock</h2><div className="admin-list">{data.cards.map((item) => <div key={item.id}><span>{item.name}</span><b>{item.quantity} · {Number(item.price).toLocaleString()} G</b></div>)}{!data.cards.length && <p>No database cards yet.</p>}</div></section></section>}
    {tab === "events" && <section className="admin-grid"><form className="admin-panel" onSubmit={addEvent}><h2>Create event</h2><input required placeholder="Event name" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })}/><input required type="datetime-local" value={event.starts_at} onChange={(e) => setEvent({ ...event, starts_at: e.target.value })}/><textarea placeholder="Rules, location, prize…" value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })}/><button className="vault-submit">Publish event</button></form><section className="admin-panel"><h2>Scheduled events</h2><div className="admin-list">{data.events.map((item) => <div key={item.id}><span>{item.title}</span><b>{new Date(item.starts_at).toLocaleString()}</b></div>)}</div></section></section>}
    {tab === "offers" && <section className="admin-panel"><h2>Offers</h2><div className="admin-list">{data.offers.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b> offered {Number(item.amount).toLocaleString()} G for {item.card_name}</span><em>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => setOffer(item.id, "accepted")}>Accept</button><button onClick={() => setOffer(item.id, "rejected")}>Decline</button></aside>}</div>)}{!data.offers.length && <p>No offers yet.</p>}</div></section>}
    {tab === "feedback" && <section className="admin-panel"><h2>Feedback moderation</h2><div className="admin-list">{data.feedback.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b><br />{item.message}</span><em>{item.approved ? "Visible" : "Pending"}</em><aside><button onClick={() => approveFeedback(item.id, !item.approved)}>{item.approved ? "Hide" : "Approve"}</button></aside></div>)}{!data.feedback.length && <p>No feedback yet.</p>}</div></section>}
    {tab === "players" && <section className="admin-panel"><h2>Player roles</h2><div className="admin-list">{data.players.map((item) => <div key={item.id} className="admin-player"><span><b>{item.username}</b><small>{item.wins}W / {item.losses}L</small></span><select value={item.role} onChange={(e) => setRole(item.id, e.target.value)}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>)}</div></section>}
  </main>;
}
