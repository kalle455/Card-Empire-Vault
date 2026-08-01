import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import officialDmoCatalog from "virtual:dmo-card-catalog";
import "./AdminDashboard.css";
import "./AdminAvailability.css";

const blankCard = { name: "", price: "", quantity: "1", category: "monster", rarity: "silver" };
const blankEvent = { title: "", starts_at: "", description: "", banlist_id: "", event_format: "five_way_ffa" };
const blankBanlist = { name: "", banned: "", limited: "" };
const blankAvailability = { title: "Card pickup", location: "DMO", starts_at: "", ends_at: "", note: "" };
const roles = ["customer", "regular_customer", "vip", "potm", "admin"];
const roleLabels = { customer: "Customer", regular_customer: "Regular Customer", vip: "V.I.P", potm: "POTM Â· Player of the Tournament", admin: "Kalenski Â· Admin" };
const eventFormats = [
  { value: "five_way_ffa", label: "5-WAY FFA", detail: "5 players", capacity: 5 },
  { value: "six_way_ffa", label: "6-WAY FFA", detail: "6 players", capacity: 6 },
  { value: "three_way_ffa", label: "3-WAY FFA", detail: "2v2v2 Â· 6 players", capacity: 6 },
  { value: "four_way_ffa", label: "4-WAY FFA", detail: "2v2v2v2 Â· 8 players", capacity: 8 },
];
const getEventFormat = (value) => eventFormats.find((format) => format.value === value) ?? { label: "OPEN FORMAT", detail: "No player limit", capacity: null };

const toLocalDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
const cardNamesFromText = (value) => [...new Set(value.split(/\n|,/).map((name) => name.trim()).filter(Boolean))];
const normaliseCardName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const adminIconPaths = {
  cards: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",
  books: "M4 5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-6a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h6z",
  offers: "M4 7h16v12H4zM8 7V5h8v2M8 12h8M8 15h5",
  trades: "M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3",
  events: "M5 5h14v15H5zM8 3v4M16 3v4M5 9h14M9 13h2M13 13h2M9 16h2",
  community: "M5 6h14v10H9l-4 4zM9 10h6M9 13h4",
  players: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5M3 20a5 5 0 0 1 10 0M14 20a4 4 0 0 1 7 0",
};

function AdminIcon({ name }) {
  return <span className="admin-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={adminIconPaths[name]} /></svg></span>;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("cards");
  const [data, setData] = useState({ cards: [], events: [], offers: [], trades: [], players: [], purchases: [], banlists: [], availability: [] });
  const [card, setCard] = useState(blankCard);
  const [event, setEvent] = useState(blankEvent);
  const [banlist, setBanlist] = useState(blankBanlist);
  const [editingEventId, setEditingEventId] = useState(null);
  const [notice, setNotice] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCatalogCard, setSelectedCatalogCard] = useState(null);
  const [winnerSelections, setWinnerSelections] = useState({});
  const [editingCard, setEditingCard] = useState(null);
  const [adminAnnouncement, setAdminAnnouncement] = useState({ title: "", body: "" });
  const [adminPoll, setAdminPoll] = useState({ question: "", options: "" });
  const [availabilityForm, setAvailabilityForm] = useState(blankAvailability);

  async function load() {
    const [cards, events, offers, trades, players, purchases, banlists, availability] = await Promise.all([
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*, banlist:banlists(name, card_names, banned_cards, limited_cards), registrations:event_registrations(player_id, player:profiles(id, username))").order("starts_at"),
      supabase.from("offers").select("*, player:profiles(username)").order("created_at", { ascending: false }),
      supabase.from("trade_offers").select("*, player:profiles(username), card:cards(name)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("username"),
      supabase.from("purchases").select("*, player:profiles(username), card:cards(name)").order("created_at", { ascending: false }),
      supabase.from("banlists").select("*").order("created_at", { ascending: false }),
      supabase.from("empire_availability").select("*").order("starts_at", { ascending: true }),
    ]);
    setData({
      cards: cards.data ?? [],
      events: events.data ?? [],
      offers: offers.data ?? [],
      trades: trades.data ?? [],
      players: players.data ?? [],
      purchases: purchases.data ?? [],
      banlists: banlists.data ?? [],
      availability: availability.data ?? [],
    });
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const term = card.name.trim();
    if (selectedCatalogCard?.name === term || term.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const query = normaliseCardName(term);
    const exact = officialDmoCatalog.filter((item) => normaliseCardName(item.name) === query);
    const startsWith = officialDmoCatalog.filter((item) => normaliseCardName(item.name).startsWith(query));
    const includes = officialDmoCatalog.filter((item) => normaliseCardName(item.name).includes(query));
    const matches = new Map();

    for (const item of [...exact, ...startsWith, ...includes]) {
      if (!matches.has(item.name)) matches.set(item.name, item);
      if (matches.size === 8) break;
    }

    const timer = setTimeout(() => setSuggestions([...matches.values()]), 120);
    return () => clearTimeout(timer);
  }, [card.name, selectedCatalogCard]);

  if (profile?.role !== "admin") {
    return <section className="admin-shell"><p className="vault-overline">RESTRICTED AREA</p><h1>Admin access only.</h1><p>Sign in with Kalenskiâ€™s administrator account to manage the Empire.</p></section>;
  }

  const totalGold = data.purchases.reduce((sum, item) => sum + Number(item.paid_gold), 0);
  const cardsSold = data.purchases.reduce((sum, item) => sum + Number(item.quantity), 0);

  async function addCard(e) {
    e.preventDefault();
    if (!selectedCatalogCard) {
      return setNotice("Choose a card from the official DMO catalogue first.");
    }

    setNotice("Getting the automatic card imageâ€¦");
    const lookup = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + encodeURIComponent(selectedCatalogCard.name))
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null);
    const found = lookup?.data?.[0];

    const { error } = await supabase.from("cards").insert({
      name: selectedCatalogCard.name,
      price: Number(card.price),
      quantity: Number(card.quantity),
      category: selectedCatalogCard.category,
      rarity: selectedCatalogCard.rarity,
      ygo_card_id: found?.id ?? null,
      image_url: found?.card_images?.[0]?.image_url ?? null,
      description: found?.desc ?? "",
    });

    if (error) return setNotice(error.message);
    setNotice(selectedCatalogCard.name + " was added to Cardstock Â· " + selectedCatalogCard.gameRarity + " rarity.");
    setCard(blankCard);
    setSelectedCatalogCard(null);
    load();
  }

  async function submitEvent(e) {
    e.preventDefault();
    const payload = {
      title: event.title,
      starts_at: event.starts_at,
      description: event.description,
      banlist_id: event.banlist_id || null,
      event_format: event.event_format,
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
      event_format: eventFormats.some((format) => format.value === item.event_format) ? item.event_format : "five_way_ffa",
    });
    setNotice("Editing " + item.title + ".");
  }

  async function deleteEvent(id, title) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    setNotice(error ? error.message : title + " was removed.");
    load();
  }

  async function confirmWinner(eventId, eventTitle) {
    const winnerId = winnerSelections[eventId];
    if (!winnerId) return setNotice("Choose a registered player first.");

    const winner = data.players.find((player) => player.id === winnerId);
    const { error } = await supabase.rpc("set_event_winner", {
      p_event_id: eventId,
      p_winner_id: winnerId,
    });

    if (error) return setNotice(error.message);
    setNotice((winner?.username ?? "The selected player") + " won " + eventTitle + " and received +1 win.");
    setWinnerSelections((current) => {
      const next = { ...current };
      delete next[eventId];
      return next;
    });
    load();
  }

  async function addBanlist(e) {
    e.preventDefault();
    const banned_cards = cardNamesFromText(banlist.banned);
    const limited_cards = cardNamesFromText(banlist.limited);
    const card_names = [...banned_cards, ...limited_cards];
    if (!card_names.length) return setNotice("Add at least one Banned or Limited card.");
    const { error } = await supabase.from("banlists").insert({
      name: banlist.name.trim(),
      card_names,
      banned_cards,
      limited_cards,
      created_by: profile.id,
    });
    if (error) return setNotice(error.message);
    setNotice(banlist.name + " was saved: " + banned_cards.length + " Banned Â· " + limited_cards.length + " Limited.");
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
      external_market_price: editingCard.external_market_price === "" || editingCard.external_market_price == null ? null : Number(editingCard.external_market_price),
      external_market_checked_at: editingCard.external_market_price === "" || editingCard.external_market_price == null ? editingCard.external_market_checked_at : new Date().toISOString(),
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

  async function respondToTrade(id, status) {
    const { data: chatId, error } = await supabase.rpc("respond_to_trade_offer", {
      p_offer_id: id,
      p_status: status,
    });
    if (error) return setNotice(error.message);
    setNotice(status === "declined" ? "Trade offer declined." : "Trade chat opened. Taking you to the inboxâ€¦");
    load();
    if (chatId) window.setTimeout(() => window.location.assign("/chats"), 450);
  }

  async function setRole(id, role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setNotice(error ? error.message : "Player role updated.");
    load();
  }

  async function deletePlayer(id, username) {
    const { data, error } = await supabase.rpc("delete_player_profile", { p_player_id: id });
    setNotice(error ? error.message : (data ?? username) + " was removed from Card Empire.");
    load();
  }

  async function publishAnnouncement(e) {
    e.preventDefault();
    const { error } = await supabase.from("community_announcements").insert({ title: adminAnnouncement.title.trim(), body: adminAnnouncement.body.trim() });
    if (error) return setNotice(error.message);
    setAdminAnnouncement({ title: "", body: "" });
    setNotice("Announcement published to the Community.");
  }

  async function publishPoll(e) {
    e.preventDefault();
    const labels = adminPoll.options.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 6);
    if (labels.length < 2) return setNotice("A poll needs at least two comma-separated options.");
    const { data: poll, error } = await supabase.from("community_polls").insert({ question: adminPoll.question.trim() }).select().single();
    if (error) return setNotice(error.message);
    const optionResult = await supabase.from("community_poll_options").insert(labels.map((label, position) => ({ poll_id: poll.id, label, position })));
    if (optionResult.error) return setNotice(optionResult.error.message);
    setAdminPoll({ question: "", options: "" });
    setNotice("Community poll opened.");
  }

  async function publishAvailability(e) {
    e.preventDefault();
    if (new Date(availabilityForm.ends_at) <= new Date(availabilityForm.starts_at)) return setNotice("The pickup window must end after it starts.");
    const { error } = await supabase.from("empire_availability").insert({
      title: availabilityForm.title.trim(),
      location: availabilityForm.location.trim(),
      starts_at: new Date(availabilityForm.starts_at).toISOString(),
      ends_at: new Date(availabilityForm.ends_at).toISOString(),
      note: availabilityForm.note.trim(),
      created_by: profile.id,
    });
    if (error) return setNotice(error.message);
    setAvailabilityForm(blankAvailability);
    setNotice("Pickup readiness published live.");
    load();
  }

  async function deleteAvailability(id) {
    const { error } = await supabase.from("empire_availability").delete().eq("id", id);
    setNotice(error ? error.message : "Pickup window removed live.");
    load();
  }

  return (
    <main className="admin-shell">
      <header><div><p className="vault-overline">KALENSKIâ„¢ CONTROL ROOM</p><h1>Empire Admin</h1></div><span>Live system</span></header>
      <nav className="admin-tabs">
        {[
          ["cards", "Cards", data.cards.length + " in stock"],
          ["books", "Buy Orders", data.purchases.length + " recorded"],
          ["offers", "Offers", data.offers.filter((entry) => entry.status === "pending").length + " pending"],
          ["trades", "Trade Orders", data.trades.filter((entry) => entry.status === "pending").length + " pending"],
          ["events", "Events & Banlists", data.events.length + " events"],
          ["community", "Community", "Team channel"],
          ["players", "Players", data.players.length + " profiles"],
        ].map(([item, label, detail]) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><AdminIcon name={item} /><b>{label}</b><small>{detail}</small></button>
        ))}
      </nav>
      {notice && <p className="admin-notice">{notice}</p>}

      {tab === "cards" && <section className="admin-grid">
        <form className="admin-panel" onSubmit={addCard}>
          <h2>Add a card</h2><p>Only cards from the official DMO catalogue can enter Cardstock. Their type and rarity are locked to the game list.</p>
          <div className="card-name-field">
            <input required autoComplete="off" placeholder="Search the official card catalogue (e.g. PO)" value={card.name} onChange={(e) => { setCard({ ...card, name: e.target.value }); setSelectedCatalogCard(null); }} />
            {suggestions.length > 0 && <div className="card-suggestions">{suggestions.map((item) => (
              <button type="button" key={item.name} onClick={() => { setCard({ ...card, name: item.name, category: item.category, rarity: item.rarity }); setSelectedCatalogCard(item); setSuggestions([]); }}>
                <span>{item.name}<small>{item.category} Â· {item.gameRarity}</small></span><b>{item.gameRarity}</b>
              </button>
            ))}</div>}
          </div>
          <div className="admin-row"><input required type="number" min="0" placeholder="Price in Gold" value={card.price} onChange={(e) => setCard({ ...card, price: e.target.value })} /><input required type="number" min="0" placeholder="Quantity" value={card.quantity} onChange={(e) => setCard({ ...card, quantity: e.target.value })} /></div>
          <div className="admin-row"><input readOnly value={selectedCatalogCard ? selectedCatalogCard.category.toUpperCase() + " Â· official type" : "Official type"} /><input readOnly value={selectedCatalogCard ? selectedCatalogCard.gameRarity + " Â· official rarity" : "Official rarity"} /></div>
          <button className="vault-submit" disabled={!selectedCatalogCard}>{selectedCatalogCard ? "Add to Cardstock" : "Choose official card"}</button>
        </form>
        <section className="admin-panel"><h2>Cardstock inventory</h2><div className="admin-list">
          {data.cards.map((item) => editingCard?.id === item.id ? (
            <form key={item.id} className="admin-card-edit" onSubmit={saveCard}>
              <strong>{item.name}</strong>
              <div className="admin-row"><label>My price<input type="number" min="0" value={editingCard.price} onChange={(e) => setEditingCard({ ...editingCard, price: e.target.value })} /></label><label>Stock<input type="number" min="0" value={editingCard.quantity} onChange={(e) => setEditingCard({ ...editingCard, quantity: e.target.value })} /></label></div>
              <div className="admin-row"><label>Other seller price<input type="number" min="0" placeholder="No exact listing" value={editingCard.external_market_price ?? ""} onChange={(e) => setEditingCard({ ...editingCard, external_market_price: e.target.value })} /></label><a className="admin-market-source" href="https://dmo-market.onrender.com/" target="_blank" rel="noreferrer">Check DMO Market â†—</a></div>
              <div className="admin-row"><select value={editingCard.category} onChange={(e) => setEditingCard({ ...editingCard, category: e.target.value })}><option value="monster">Monster</option><option value="spell">Spell</option><option value="trap">Trap</option></select><select value={editingCard.rarity} onChange={(e) => setEditingCard({ ...editingCard, rarity: e.target.value })}><option value="common">Common</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="rainbow">Rainbow</option></select></div>
              <aside><button type="submit">Save</button><button type="button" onClick={() => setEditingCard(null)}>Cancel</button></aside>
            </form>
          ) : (
            <div key={item.id} className="admin-stock"><span>{item.name}</span><b>{item.quantity} Â· {Number(item.price).toLocaleString()} G</b><aside><button onClick={() => setEditingCard(item)}>Edit</button><button onClick={() => deleteCard(item.id, item.name)}>Remove</button></aside></div>
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
            <select value={event.event_format} onChange={(e) => setEvent({ ...event, event_format: e.target.value })}>
              {eventFormats.map((format) => <option value={format.value} key={format.value}>{format.label} Â· {format.detail}</option>)}
            </select>
            <select value={event.banlist_id} onChange={(e) => setEvent({ ...event, banlist_id: e.target.value })}><option value="">No banlist assigned</option>{data.banlists.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
            <textarea placeholder="Rules, location, prizeâ€¦" value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })} />
            <button className="vault-submit">{editingEventId ? "Save event" : "Publish event"}</button>
            {editingEventId && <button type="button" className="admin-secondary" onClick={() => { setEditingEventId(null); setEvent(blankEvent); }}>Cancel edit</button>}
          </form>

          <form className="admin-panel" onSubmit={addBanlist}>
            <h2>Create banlist</h2><p>Paste one card per line, or separate cards with commas. Duplicate names are removed automatically.</p>
            <input required placeholder="Banlist name" value={banlist.name} onChange={(e) => setBanlist({ ...banlist, name: e.target.value })} />
            <label className="banlist-field"><span>Banned cards</span><textarea placeholder={"Pot of Greed\nGraceful Charity\nâ€¦"} value={banlist.banned} onChange={(e) => setBanlist({ ...banlist, banned: e.target.value })} /></label>
            <label className="banlist-field"><span>Limited cards</span><textarea placeholder={"Jinzo\nCaius the Shadow Monarch\nâ€¦"} value={banlist.limited} onChange={(e) => setBanlist({ ...banlist, limited: e.target.value })} /></label>
            <button className="vault-submit">Save banlist</button>
          </form>
        </div>

        <section className="admin-panel"><h2>Scheduled events</h2><div className="admin-list">
          {data.events.map((item) => {
            const registrations = item.registrations ?? [];
            const eventFormat = getEventFormat(item.event_format);
            const selectedWinnerId = winnerSelections[item.id] ?? "";
            const winner = data.players.find((player) => player.id === item.winner_id);

            return <div key={item.id} className="admin-event-row">
              <span>
                <b>{item.title}</b>
                <small>{new Date(item.starts_at).toLocaleString()} Â· {eventFormat.label} Â· {eventFormat.detail} Â· {registrations.length}{eventFormat.capacity ? " / " + eventFormat.capacity : ""} registered Â· {item.banlist?.name ?? "No banlist"}</small>
                {winner && <em className="event-winner-badge">WINNER Â· {winner.username} Â· +1 WIN</em>}
              </span>
              {!winner && <div className="event-winner-controls">
                <select value={selectedWinnerId} onChange={(event) => setWinnerSelections((current) => ({ ...current, [item.id]: event.target.value }))}>
                  <option value="">Choose winner</option>
                  {registrations.map((registration) => <option key={registration.player_id} value={registration.player_id}>{registration.player?.username ?? "Player"}</option>)}
                </select>
                <button disabled={!selectedWinnerId} onClick={() => confirmWinner(item.id, item.title)}>Confirm winner</button>
              </div>}
              <aside><button onClick={() => editEvent(item)}>Edit</button><button onClick={() => deleteEvent(item.id, item.title)}>Remove</button></aside>
            </div>;
          })}
          {!data.events.length && <p>No events scheduled yet.</p>}
        </div></section>

        <section className="admin-panel"><h2>Banlist Library</h2><div className="admin-list">
          {data.banlists.map((item) => { const banned = item.banned_cards ?? []; const limited = item.limited_cards ?? []; const allCards = [...banned, ...limited]; return <div key={item.id} className="admin-banlist-row"><span><b>{item.name}</b><small>{banned.length} Banned Â· {limited.length} Limited Â· {allCards.slice(0, 4).join(" Â· ")}{allCards.length > 4 ? " â€¦" : ""}</small></span><button onClick={() => deleteBanlist(item.id, item.name)}>Remove</button></div>; })}
          {!data.banlists.length && <p>No banlists saved yet.</p>}
        </div></section>
      </section>}

      {tab === "offers" && <section className="admin-panel"><h2>Offers</h2><div className="admin-list">
        {data.offers.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b> offered {Number(item.amount).toLocaleString()} G for {item.card_name}</span><em>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => setOffer(item.id, "accepted")}>Accept</button><button onClick={() => setOffer(item.id, "rejected")}>Decline</button></aside>}</div>)}
        {!data.offers.length && <p>No offers yet.</p>}
      </div></section>}

      {tab === "trades" && <section className="admin-panel admin-order-panel"><header className="admin-order-heading"><div><p className="vault-overline">EXCHANGE DESK</p><h2>Trade Orders</h2></div><span>{data.trades.filter((entry) => entry.status === "pending").length} awaiting action</span></header><p>Players choose a Cardstock card and propose what they offer in return. Accepting or negotiating opens the private live chat.</p><div className="admin-list">
        {data.trades.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b> wants <strong>{item.card?.name ?? item.card_name_snapshot ?? "Removed Cardstock card"}</strong><br /><small>Offers: {item.offered_cards}</small>{item.message && <small>Message: {item.message}</small>}</span><em>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => respondToTrade(item.id, "accepted")}>Accept + chat</button><button onClick={() => respondToTrade(item.id, "negotiating")}>Negotiate + chat</button><button onClick={() => respondToTrade(item.id, "declined")}>Decline</button></aside>}{item.chat_id && <aside><button onClick={() => window.location.assign("/chats")}>Open chat</button></aside>}</div>)}
        {!data.trades.length && <p>No Trade Hub offers yet.</p>}
      </div></section>}

      {tab === "books" && <section className="admin-books admin-order-panel">
        <div className="sales-summary"><article><small>Total Gold</small><strong>{totalGold.toLocaleString()} G</strong></article><article><small>Cards sold</small><strong>{cardsSold}</strong></article><article><small>Purchases</small><strong>{data.purchases.length}</strong></article></div>
        <section className="admin-panel"><header className="admin-order-heading"><div><p className="vault-overline">SALES LEDGER</p><h2>Buy Orders</h2></div><span>{data.purchases.length} recorded</span></header><p>Every completed purchase is saved here with buyer, card, price and time.</p><div className="admin-list">
          {data.purchases.map((item) => <div key={item.id} className="admin-sale"><span><b>{item.card?.name ?? item.card_name ?? "Removed card"}</b><small>Buyer: {item.player?.username ?? "Player"} Â· {item.quantity} copy/copies</small></span><span><b>{Number(item.paid_gold).toLocaleString()} G</b><small>{new Date(item.created_at).toLocaleString()}</small></span></div>)}
          {!data.purchases.length && <p>No purchases have been recorded yet.</p>}
        </div></section>
      </section>}

      {tab === "community" && <section className="admin-community-console">
        <header><div><p className="vault-overline">CARD EMPIRE TEAM CHANNEL</p><h2>Speak directly to the community.</h2></div><button type="button" onClick={() => window.location.assign("/community")}>View public Community â†—</button></header>
        <div className="admin-grid">
          <form className="admin-panel" onSubmit={publishAnnouncement}><AdminIcon name="community" /><h3>New announcement</h3><p>Send an official message to every verified player.</p><input required value={adminAnnouncement.title} onChange={(e) => setAdminAnnouncement({ ...adminAnnouncement, title: e.target.value })} placeholder="Announcement title" /><textarea required value={adminAnnouncement.body} onChange={(e) => setAdminAnnouncement({ ...adminAnnouncement, body: e.target.value })} placeholder="Message to every player" /><button className="vault-submit">Publish announcement</button></form>
          <form className="admin-panel" onSubmit={publishPoll}><AdminIcon name="offers" /><h3>New community poll</h3><p>Separate each answer with a comma. Up to six options are supported.</p><input required value={adminPoll.question} onChange={(e) => setAdminPoll({ ...adminPoll, question: e.target.value })} placeholder="Community question" /><input required value={adminPoll.options} onChange={(e) => setAdminPoll({ ...adminPoll, options: e.target.value })} placeholder="Option one, Option two, Option three" /><button className="vault-submit">Open poll</button></form>
          <form className="admin-panel admin-availability-panel" onSubmit={publishAvailability}><AdminIcon name="events" /><h3>Pickup readiness</h3><p>Publish when you are online and when customers can collect their cards.</p><div className="admin-row"><input required value={availabilityForm.title} onChange={(e) => setAvailabilityForm({ ...availabilityForm, title: e.target.value })} placeholder="Card pickup" /><input required value={availabilityForm.location} onChange={(e) => setAvailabilityForm({ ...availabilityForm, location: e.target.value })} placeholder="Location / server" /></div><div className="admin-row"><label>Online from<input required type="datetime-local" value={availabilityForm.starts_at} onChange={(e) => setAvailabilityForm({ ...availabilityForm, starts_at: e.target.value })} /></label><label>Online until<input required type="datetime-local" value={availabilityForm.ends_at} onChange={(e) => setAvailabilityForm({ ...availabilityForm, ends_at: e.target.value })} /></label></div><textarea value={availabilityForm.note} maxLength="600" onChange={(e) => setAvailabilityForm({ ...availabilityForm, note: e.target.value })} placeholder="Optional pickup note" /><button className="vault-submit">Publish live window</button></form>
          <section className="admin-panel admin-availability-list"><AdminIcon name="community" /><h3>Published windows</h3><p>These times update immediately for every verified player.</p><div>{data.availability.map((slot) => <article key={slot.id}><span><b>{slot.title}</b><small>{new Date(slot.starts_at).toLocaleString()} â€“ {new Date(slot.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} Â· {slot.location}</small></span><button type="button" onClick={() => deleteAvailability(slot.id)}>Remove</button></article>)}{!data.availability.length && <small>No pickup windows published.</small>}</div></section>
        </div>
      </section>}

      {tab === "players" && <section className="admin-panel"><h2>Player roles</h2><p>Delete removes the player profile and their Empire data. Administrator profiles are protected.</p><div className="admin-list">
        {data.players.map((item) => <div key={item.id} className="admin-player"><span><b>{item.dmo_name || "DMO name missing"}</b><small>Discord @{item.username} Â· {item.wins}W / {item.losses}L</small></span><select value={roles.includes(item.role) ? item.role : "customer"} onChange={(e) => setRole(item.id, e.target.value)}>{roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select>{item.id !== profile.id && item.role !== "admin" && <button className="admin-delete-player" onClick={() => deletePlayer(item.id, item.dmo_name || item.username)}>Delete player</button>}</div>)}
      </div></section>}
    </main>
  );
}