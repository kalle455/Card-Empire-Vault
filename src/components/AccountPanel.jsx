import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const roleLabels = {
  vip: "V.I.P",
  potm: "POTM · Player of the Tournament",
  player_of_the_tournament: "POTM · Player of the Tournament",
  regular_customer: "Regular Customer",
  regular: "Regular Customer",
  customer: "Customer",
  admin: "Kalenski · Admin",
};

const loyaltyLevel = (points) => {
  if (points >= 100) return { name: "Cardstock Legend", next: null, color: "legend" };
  if (points >= 50) return { name: "Empire Elite", next: 100, color: "elite" };
  if (points >= 20) return { name: "Regular Customer", next: 50, color: "regular" };
  if (points >= 10) return { name: "Regular Customer", next: 20, color: "regular" };
  return { name: "Cardstock Initiate", next: 10, color: "initiate" };
};

function rankFromLevel(level) {
  if (level >= 25) return "Empire Legend";
  if (level >= 15) return "Elite Duelist";
  if (level >= 10) return "Regular Customer";
  if (level >= 5) return "Challenger";
  return "Initiate";
}

function DiscordMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 5.3A16 16 0 0 0 15 4l-.5 1.1a14 14 0 0 0-5 0L9 4a16 16 0 0 0-3.9 1.3C2.6 9 1.9 12.5 2.2 16a16 16 0 0 0 4.9 2.5l1.2-1.6a10 10 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.7 1.7 11.3 0l.6.4c-.6.4-1.3.7-1.9.9l1.2 1.6A16 16 0 0 0 23 16c.4-4.1-.7-7.5-4.1-10.7ZM8.7 14.2c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z" /></svg>;
}

export default function AccountPanel() {
  const { configured, loading, session, profile, signInWithDiscord, saveDmoName, signOut, discordConnected } = useAuth();
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [savingDmo, setSavingDmo] = useState(false);
  const [dmoName, setDmoName] = useState("");
  const [tab, setTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  async function loadPlayerRecords() {
    if (!session?.user?.id || !discordConnected) return;
    const [orderResult, wishResult] = await Promise.all([
      supabase.from("purchases").select("id,quantity,paid_gold,created_at,card_name,card:cards(name,image_url,ygo_card_id,rarity)").eq("player_id", session.user.id).order("created_at", { ascending: false }),
      supabase.from("wishlists").select("id,created_at,card:cards(id,name,image_url,ygo_card_id,rarity,category,price,quantity)").eq("player_id", session.user.id).order("created_at", { ascending: false }),
    ]);
    setOrders(orderResult.data ?? []);
    setWishlist(wishResult.data ?? []);
  }

  useEffect(() => {
    loadPlayerRecords();
    if (!session?.user?.id || !discordConnected) return undefined;
    const channel = supabase.channel("profile-records-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter: "player_id=eq." + session.user.id }, loadPlayerRecords)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlists", filter: "player_id=eq." + session.user.id }, loadPlayerRecords)
      .subscribe();
    return () => channel.unsubscribe();
  }, [session?.user?.id, discordConnected]);

  async function connectDiscord() {
    setMessage("");
    setConnecting(true);
    const { error } = await signInWithDiscord();
    if (error) { setMessage(error.message); setConnecting(false); }
  }

  async function saveDmoIdentity(event) {
    event.preventDefault();
    setMessage("");
    setSavingDmo(true);
    const { error } = await saveDmoName(dmoName);
    if (error) setMessage(error.message);
    setSavingDmo(false);
  }

  async function removeWish(id) {
    const { error } = await supabase.from("wishlists").delete().eq("id", id);
    if (error) setMessage(error.message); else loadPlayerRecords();
  }

  if (!configured) return <div className="account-card"><h2>Discord access</h2><p>Player access will be available shortly.</p></div>;
  if (loading) return <div className="account-card">Checking Discord connection…</div>;

  if (!session || !discordConnected) return <section className="account-card discord-access-card">
    <p className="overline">CARD EMPIRE · VERIFIED ACCESS</p><div className="discord-access-mark"><DiscordMark /></div>
    <h2>Continue with Discord</h2>
    <p className="account-subtitle">A connected Discord account is required to enter the Card Market, Trade Hub and private chats. Card Empire uses only your Discord ID and username — never your personal email, messages, friends or servers.</p>
    <button className="discord-login-button" type="button" onClick={connectDiscord} disabled={connecting}><DiscordMark /><span>{connecting ? "Connecting…" : "Connect Discord account"}</span></button>
    {message && <p className="account-message">{message}</p>}
  </section>;

  if (!profile?.dmo_name) return <div className="dmo-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="dmo-onboarding-title">
    <section className="account-card discord-access-card dmo-name-card">
      <div className="dmo-menu-scan" aria-hidden="true" />
      <header className="dmo-menu-head"><span><i /> Discord verified</span><small>PLAYER ID · 01</small></header>
      <div className="discord-access-mark"><DiscordMark /></div>
      <p className="overline">FINAL PLAYER STEP</p><h2 id="dmo-onboarding-title">Enter your DMO name</h2>
      <p className="account-subtitle">Enter the exact player name Kalenski will see inside DMO. It is stored separately from your Discord username.</p>
      <form onSubmit={saveDmoIdentity}><label htmlFor="dmo-player-name">DMO player name</label><input id="dmo-player-name" autoFocus value={dmoName} onChange={(event) => setDmoName(event.target.value)} minLength="2" maxLength="30" autoComplete="off" required placeholder="Your exact name in DMO" /><button className="discord-login-button" type="submit" disabled={savingDmo}><span>{savingDmo ? "Saving identity…" : "Enter Card Empire"}</span><b>↗</b></button></form>
      <p className="dmo-discord-record">Connected as <b>@{profile?.username ?? "verified"}</b><span>No personal email stored</span></p>{message && <p className="account-message">{message}</p>}
      <button className="button-quiet player-signout" type="button" onClick={signOut}>Use another Discord account</button>
    </section>
  </div>;

  const activeRole = String(profile?.role ?? "customer").toLowerCase().replace(/\s+/g, "_");
  const timedVip = Boolean(profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now());
  const loyaltyPoints = Number(profile?.loyalty_points ?? 0);
  const loyaltyPurchases = Number(profile?.loyalty_purchases ?? 0);
  const cardstockPasses = Number(profile?.loyalty_free_card_credits ?? 0);
  const loyalty = loyaltyLevel(loyaltyPoints);
  const levelStart = loyaltyPoints >= 100 ? 100 : loyaltyPoints >= 50 ? 50 : loyaltyPoints >= 20 ? 20 : loyaltyPoints >= 10 ? 10 : 0;
  const loyaltyProgress = loyalty.next ? Math.min(100, Math.round(((loyaltyPoints - levelStart) / (loyalty.next - levelStart)) * 100)) : 100;
  const displayedRole = timedVip && activeRole !== "vip" ? "V.I.P PASS" : (roleLabels[activeRole] ?? "Customer");
  const xp = Number(profile?.xp ?? 0);
  const level = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;
  const rank = rankFromLevel(level);
  const totals = orders.reduce((sum, order) => sum + Number(order.paid_gold ?? 0), 0);
  const imageFor = (card) => card?.ygo_card_id ? `https://images.ygoprodeck.com/images/cards/${card.ygo_card_id}.jpg` : card?.image_url;

  return <section className="profile-command">
    <header className="profile-command-hero">
      <div><p className="overline">PLAYER PROFILE · DISCORD VERIFIED</p><small>DMO PLAYER · DISCORD @{profile?.username ?? "verified"}</small><h1>{profile?.dmo_name}</h1><span className="player-profile-status"><i /> Online</span></div>
      <aside><span><small>LEVEL</small><b>{String(level).padStart(2, "0")}</b></span><span><small>RANK</small><b>{rank}</b></span></aside>
    </header>

    <nav className="profile-tabs" aria-label="Profile sections">{[["overview","Overview"],["orders","My Orders"],["wishlist","Wishlist"]].map(([value,label]) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>

    {tab === "overview" && <div className="profile-overview-grid">
      <section className="profile-stat-deck"><article><small>W / L</small><b>{profile?.wins ?? 0} <i>/</i> {profile?.losses ?? 0}</b></article><article><small>ROLE</small><b className={"role-chip role-" + (timedVip ? "vip" : activeRole)}>{displayedRole}</b></article><article><small>ORDER VALUE</small><b>{totals.toLocaleString()} G</b></article></section>
      <section className="xp-record"><header><div><small>XP PROGRESS</small><b>Level {level} · {rank}</b></div><strong>{xpProgress}<small>/100 XP</small></strong></header><div><i style={{ width: xpProgress + "%" }} /></div><p>{level >= 10 ? "Regular Customer status reached." : `${10 - level} level${10 - level === 1 ? "" : "s"} until Regular Customer.`}</p></section>
      <section className={"loyalty-record loyalty-" + loyalty.color}><header><div><small>EMPIRE LOYALTY</small><b>{loyalty.name}</b></div><strong>{loyaltyPoints} <small>PTS</small></strong></header><div className="loyalty-progress"><i style={{ width: loyaltyProgress + "%" }} /></div><footer><span>{loyalty.next ? loyalty.next - loyaltyPoints + " pts to " + (loyalty.next === 10 ? "Regular Customer" : loyalty.next === 20 ? "Cardstock Pass" : loyalty.next === 50 ? "7-day V.I.P Pass" : "30-day V.I.P Pass") : "Maximum loyalty level reached"}</span><b>{loyaltyPurchases} purchases · {cardstockPasses} Cardstock Pass{cardstockPasses === 1 ? "" : "es"}</b></footer>{timedVip && <p>V.I.P Pass active until {new Date(profile.vip_until).toLocaleDateString()} · −25% in Cardstock</p>}</section>
    </div>}

    {tab === "orders" && <section className="profile-record-list"><header><div><p className="overline">ORDER HISTORY</p><h2>Every completed request.</h2></div><span>{orders.length} orders</span></header>{orders.map((order) => <article key={order.id}><span className="profile-record-art">{imageFor(order.card) && <img src={imageFor(order.card)} alt="" />}</span><div><small>{new Date(order.created_at).toLocaleString()}</small><h3>{order.card_name ?? order.card?.name ?? "Cardstock order"}</h3><p>{order.card?.rarity ?? "Card Empire card"} · Quantity {order.quantity}</p></div><strong>{Number(order.paid_gold).toLocaleString()} G</strong></article>)}{!orders.length && <p className="profile-empty">Your first order will appear here automatically.</p>}</section>}

    {tab === "wishlist" && <section className="profile-record-list wishlist-record-list"><header><div><p className="overline">WISHLIST WATCH</p><h2>Cards on your radar.</h2></div><span>{wishlist.length} watched</span></header>{wishlist.map((wish) => <article key={wish.id}><span className="profile-record-art">{imageFor(wish.card) && <img src={imageFor(wish.card)} alt="" />}</span><div><small>{wish.card?.rarity} · {wish.card?.category}</small><h3>{wish.card?.name ?? "Card"}</h3><p className={wish.card?.quantity > 0 ? "is-available" : "is-sold"}>{wish.card?.quantity > 0 ? `${wish.card.quantity} available now` : "Currently sold"}</p></div><strong>{Number(wish.card?.price ?? 0).toLocaleString()} G</strong><button type="button" onClick={() => removeWish(wish.id)}>Remove</button></article>)}{!wishlist.length && <p className="profile-empty">Save a card in Cardstock and it will appear here. Availability updates stay inside Card Empire.</p>}</section>}

    {message && <p className="account-message">{message}</p>}<button className="button-quiet player-signout" onClick={signOut}>Sign out of Discord</button>
  </section>;
}
