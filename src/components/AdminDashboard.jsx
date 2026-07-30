import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./AdminDashboard.css";

const blankCard = { name: "", price: "", quantity: "1", category: "monster", rarity: "rare" };
const blankEvent = { title: "", starts_at: "", description: "", banlist_id: "" };
const blankBanlist = { name: "", cards: "" };
const roles = ["customer", "regular_customer", "trusted_trader", "vip", "potm", "admin"];

const toLocalDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
const cardNamesFromText = (value) => value.split(/\n|,/).map((name) => name.trim()).filter(Boolean);

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("cards");
  const [data, setData] = useState({ cards: [], events: [], offers: [], feedback: [], players: [], purchases: [], banlists: [] });
  const [card, setCard] = useState(blankCard);
  const [event, setEvent] = useState(blankEvent);
  const [banlist, setBanlist] = useState(blankBanlist);
  const [editingEventId, setEditingEventId] = useState(null);
  const [notice, setNotice] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [editingCard, setEditingCard] = useState(null);

  async function load() {
    const [cards, events, offers, feedback, players, purchases, banlists] = await Promise.all([
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*, banlist:banlists(name, card_names)").order("starts_at"),
      supabase.from("offers").select("*, player:profiles(username)").order("created_at", { ascending: false }),
      supabase.from("feedback").select("*, player:profiles(username)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("username"),
      supabase.from("purchases").select("*, player:profiles(username), card:cards(name)").order("created_at", { ascending: false }),
      supabase.from("banlists").select("*").order("created_at", { ascending: false }),
    ]);
    setData({
      cards: cards.data ?? [],
      events: events.data ?? [],
      offers: offers.data ?? [],
      feedback: feedback.data ?? [],
      players: players.data ?? [],
      purchases: purchases.data ?? [],
      banlists: banlists.data ?? [],
    });
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const term = card.name.trim();
    if (term.length < 2) { setSuggestions([]); return undefined; }
    const timer = setTimeout(async () => {
      const result = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=" + encodeURIComponent(term))
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null);
      setSuggestions(result?.data?.slice(0, 6) ?? []);
    }, 240);
    return () => clearTimeout(timer);
  }, [card.name]);

  if (profile?.role !== "admin") {
    return <section className="admin-shell"><p className="vault-overline">RESTRICTED AREA</p><h1>Admin access only.</h1><p>Sign in with Kalenski’s administrator account to manage the Empire.</p></section>;
  }

  const totalGold = data.purchases.reduce((sum, item) => sum + Number(item.paid_gold), 0);
  const cardsSold = data.purchases.reduce((sum, item) => sum + Number(item.quantity), 0);

  async function addCard(e) {
    e.preventDefault();
    setNotice("Searching YGOPRODeck for the card image…");
    const lookup = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + encodeURIComponent(card.name))
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null);
    const found = lookup?.data?.[0];
    const { error } = await supabase.from("cards").insert({
      name: card.name,
      price: Number(card.price),
      quantity: Number(card.quantity),
      category: card.category,
      rarity: card.rarity,
      ygo_card_id: found?.id ?? null,
      image_url: found?.card_images?.[0]?.image_url ?? null,
      description: found?.desc ?? "",
    });
    if (error) return setNotice(error.message);
    setNotice(card.name + " was added to the Vault.");
    setCard(blankCard);
    load();
  }

  async function submitEvent(e) {
    e.preventDefault();
    const payload = {
      title: event.title,
      starts_at: event.starts_at,
      description: event.description,
      banlist_id: event.banlist_id || null,
    };
    const result = editingEventId
      ? await supabase.from("events").update(payload).eq("id", editingEventId)
      : await supabase.from("events").insert({ ...payload, created_by: profile.id });

    if (result.error) return setNotice(result.error.message);
    setNotice(editingEventId ? "Event updated and players were notified." : "Event created and players were notified.");
    setEvent(blankEvent);
    setEditingEventId(null);
    load();
  }

  function editEvent(item) {
    setEditingEventId(item.id);
    setEvent({
      title: item.title,
      starts_at: toLocalDateTime(item.starts_at),
      description: item.description ?? "",
      banlist_id: item.banlist_id ?? "",
    });
    setNotice("Editing " + item.title + ".");
  }

  async function deleteEvent(id, title) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    setNotice(error ? error.message : title + " was removed.");
    load();
  }

  async function addBanlist(e) {
    e.preventDefault();
    const card_names = cardNamesFromText(banlist.cards);
    if (!card_names.length) return setNotice("Add at least one card to the banlist.");
    const { error } = await supabase.from("banlists").insert({
      name: banlist.name.trim(),
      card_names,
      created_by: profile.id,
    });
    if (error) return setNotice(error.message);
    setNotice(banlist.name + " was saved with " + card_names.length + " cards.");
    setBanlist(blankBanlist);
    load();
  }

  async function deleteBanlist(id, name) {
    const { error } = await supabase.from("banlists").delete().eq("id", id);
    setNotice(error ? error.message : name + " was removed from the Banlist Library.");
    load();
  }

  async function deleteCard(id, name) {
    const { error } = await supabase.from("cards").delete().eq("id", id);
    setNotice(error ? error.message : name + " was removed.");
    load();
  }

  async function saveCard(e) {
    e.preventDefault();
    const { error } = await supabase.from("cards").update({
      price: Number(editingCard.price),
      quantity: Number(editingCard.quantity),
      category: editingCard.category,
      rarity: editingCard.rarity,
    }).eq("id", editingCard.id);
    if (error) return setNotice(error.message);
    setNotice(editingCard.name + " was updated.");
    setEditingCard(null);
    load();
  }

  async function setOffer(id, status) {
    const { error } = await supabase.from("offers").update({ status }).eq("id", id);
    setNotice(error ? error.message : "Offer " + status + ".");
    load();
  }

  async function approveFeedback(id, approved) {
    const { error } = await supabase.from("feedback").update({ approved }).eq("id", id);
    setNotice(error ? error.message : approved ? "Feedback approved." : "Feedback hidden.");
    load();
  }

  async function setRole(id, role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setNotice(error ? error.message : "Player role updated.");
    load();
  }

  return (
    <main className="admin-shell">
      <header><div><p className="vault-overline">KALENSKI™ CONTROL ROOM</p><h1>Empire Admin</h1></div><span>Live system</span></header>
      <nav className="admin-tabs">
        {[["cards", "Cards"], ["events", "Events & Banlists"], ["offers", "Offers"], ["books", "Bücher"], ["feedback", "Feedback"], ["players", "Players"]].map(([item, label]) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{label}</button>
        ))}
      </nav>
      {notice && <p className="admin-notice">{notice}</p>}

      {tab === "cards" && <section className="admin-grid">
        <form className="admin-panel" onSubmit={addCard}>
          <h2>Add a card</h2><p>Enter only the card name — the official image and details are found automatically.</p>
          <div className="card-name-field">
            <input required autoComplete="off" placeholder="Start typing a card name (e.g. PO)" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
            {suggestions.length > 0 && <div className="card-suggestions">{suggestions.map((item) => (
              <button type="button" key={item.id} onClick={() => { setCard({ ...card, name: item.name }); setSuggestions([]); }}>
                <img src={item.card_images?.[0]?.image_url_small} alt="" /><span>{item.name}<small>{item.type}</small></span>
              </button>
            ))}</div>}
          </div>
          <div className="admin-row"><input required type="number" min="0" placeholder="Price in Gold" value={card.price} onChange={(e) => setCard({ ...card, price: e.target.value })} /><input required type="number" min="0" placeholder="Quantity" value={card.quantity} onChange={(e) => setCard({ ...card, quantity: e.target.value })} /></div>
          <div className="admin-row"><select value={card.category} onChange={(e) => setCard({ ...card, category: e.target.value })}><option value="monster">Monster</option><option value="spell">Spell</option><option value="trap">Trap</option></select><select value={card.rarity} onChange={(e) => setCard({ ...card, rarity: e.target.value })}><option value="common">Common</option><option value="rare">Rare</option><option value="gold">Gold</option><option value="rainbow">Rainbow</option></select></div>
          <button className="vault-submit">Add to vault</button>
        </form>
        <section className="admin-panel"><h2>Vault stock</h2><div className="admin-list">
          {data.cards.map((item) => editingCard?.id === item.id ? (
            <form key={item.id} className="admin-card-edit" onSubmit={saveCard}>
              <strong>{item.name}</strong>
              <div className="admin-row"><label>Price<input type="number" min="0" value={editingCard.price} onChange={(e) => setEditingCard({ ...editingCard, price: e.target.value })} /></label><label>Stock<input type="number" min="0" value={editingCard.quantity} onChange={(e) => setEditingCard({ ...editingCard, quantity: e.target.value })} /></label></div>
              <div className="admin-row"><select value={editingCard.category} onChange={(e) => setEditingCard({ ...editingCard, category: e.target.value })}><option value="monster">Monster</option><option value="spell">Spell</option><option value="trap">Trap</option></select><select value={editingCard.rarity} onChange={(e) => setEditingCard({ ...editingCard, rarity: e.target.value })}><option value="common">Common</option><option value="rare">Rare</option><option value="gold">Gold</option><option value="rainbow">Rainbow</option></select></div>
              <aside><button type="submit">Save</button><button type="button" onClick={() => setEditingCard(null)}>Cancel</button></aside>
            </form>
          ) : (
            <div key={item.id} className="admin-stock"><span>{item.name}</span><b>{item.quantity} · {Number(item.price).toLocaleString()} G</b><aside><button onClick={() => setEditingCard(item)}>Edit</button><button onClick={() => deleteCard(item.id, item.name)}>Remove</button></aside></div>
          ))}
          {!data.cards.length && <p>No database cards yet.</p>}
        </div></section>
      </section>}

      {tab === "events" && <section className="admin-events">
        <div className="admin-grid">
          <form className="admin-panel" onSubmit={submitEvent}>
            <h2>{editingEventId ? "Edit event" : "Create event"}</h2>
            <input required placeholder="Event name" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} />
            <input required type="datetime-local" value={event.starts_at} onChange={(e) => setEvent({ ...event, starts_at: e.target.value })} />
            <select value={event.banlist_id} onChange={(e) => setEvent({ ...event, banlist_id: e.target.value })}><option value="">No banlist assigned</option>{data.banlists.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
            <textarea placeholder="Rules, location, prize…" value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })} />
            <button className="vault-submit">{editingEventId ? "Save event" : "Publish event"}</button>
            {editingEventId && <button type="button" className="admin-secondary" onClick={() => { setEditingEventId(null); setEvent(blankEvent); }}>Cancel edit</button>}
          </form>

          <form className="admin-panel" onSubmit={addBanlist}>
            <h2>Create banlist</h2><p>Paste one card per line, or separate cards with commas.</p>
            <input required placeholder="Banlist name" value={banlist.name} onChange={(e) => setBanlist({ ...banlist, name: e.target.value })} />
            <textarea required placeholder={"Pot of Greed\nGraceful Charity\n…"} value={banlist.cards} onChange={(e) => setBanlist({ ...banlist, cards: e.target.value })} />
            <button className="vault-submit">Save banlist</button>
          </form>
        </div>

        <section className="admin-panel"><h2>Scheduled events</h2><div className="admin-list">
          {data.events.map((item) => <div key={item.id} className="admin-event-row"><span><b>{item.title}</b><small>{new Date(item.starts_at).toLocaleString()} · {item.banlist?.name ?? "No banlist"}</small></span><aside><button onClick={() => editEvent(item)}>Edit</button><button onClick={() => deleteEvent(item.id, item.title)}>Remove</button></aside></div>)}
          {!data.events.length && <p>No events scheduled yet.</p>}
        </div></section>

        <section className="admin-panel"><h2>Banlist Library</h2><div className="admin-list">
          {data.banlists.map((item) => <div key={item.id} className="admin-banlist-row"><span><b>{item.name}</b><small>{item.card_names.length} cards · {item.card_names.slice(0, 4).join(" · ")}{item.card_names.length > 4 ? " …" : ""}</small></span><button onClick={() => deleteBanlist(item.id, item.name)}>Remove</button></div>)}
          {!data.banlists.length && <p>No banlists saved yet.</p>}
        </div></section>
      </section>}

      {tab === "offers" && <section className="admin-panel"><h2>Offers</h2><div className="admin-list">
        {data.offers.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b> offered {Number(item.amount).toLocaleString()} G for {item.card_name}</span><em>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => setOffer(item.id, "accepted")}>Accept</button><button onClick={() => setOffer(item.id, "rejected")}>Decline</button></aside>}</div>)}
        {!data.offers.length && <p>No offers yet.</p>}
      </div></section>}

      {tab === "books" && <section className="admin-books">
        <div className="sales-summary"><article><small>Total Gold</small><strong>{totalGold.toLocaleString()} G</strong></article><article><small>Cards sold</small><strong>{cardsSold}</strong></article><article><small>Purchases</small><strong>{data.purchases.length}</strong></article></div>
        <section className="admin-panel"><h2>Sales book</h2><p>Every completed purchase is saved here with buyer, card, price and time.</p><div className="admin-list">
          {data.purchases.map((item) => <div key={item.id} className="admin-sale"><span><b>{item.card?.name ?? "Card"}</b><small>Buyer: {item.player?.username ?? "Player"} · {item.quantity} copy/copies</small></span><span><b>{Number(item.paid_gold).toLocaleString()} G</b><small>{new Date(item.created_at).toLocaleString()}</small></span></div>)}
          {!data.purchases.length && <p>No purchases have been recorded yet.</p>}
        </div></section>
      </section>}

      {tab === "feedback" && <section className="admin-panel"><h2>Feedback moderation</h2><div className="admin-list">
        {data.feedback.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b><br />{item.message}</span><em>{item.approved ? "Visible" : "Pending"}</em><aside><button onClick={() => approveFeedback(item.id, !item.approved)}>{item.approved ? "Hide" : "Approve"}</button></aside></div>)}
        {!data.feedback.length && <p>No feedback yet.</p>}
      </div></section>}

      {tab === "players" && <section className="admin-panel"><h2>Player roles</h2><div className="admin-list">
        {data.players.map((item) => <div key={item.id} className="admin-player"><span><b>{item.username}</b><small>{item.wins}W / {item.losses}L</small></span><select value={item.role} onChange={(e) => setRole(item.id, e.target.value)}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>)}
      </div></section>}
    </main>
  );
}
