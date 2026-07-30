import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Marketplace from "./components/Marketplace";
import AccountPanel from "./components/AccountPanel";
import AdminDashboard from "./components/AdminDashboard";
import NotificationsPanel from "./components/NotificationsPanel";
import { useAuth } from "./context/AuthContext";
import { addFeedback, getEvents, registerForEvent, subscribeToLiveChanges } from "./services/communityApi";
import "./index.css";

const featured = [
  { name: "Jinzo", rarity: "Rainbow", price: "50,000 G", image: "https://images.ygoprodeck.com/images/cards/77585513.jpg" },
  { name: "Cyber Dragon", rarity: "Gold", price: "22,000 G", image: "https://images.ygoprodeck.com/images/cards/70095154.jpg" },
  { name: "Blue-Eyes White Dragon", rarity: "Rare", price: "18,000 G", image: "https://images.ygoprodeck.com/images/cards/89631139.jpg" },
];

function Home() {
  return <div className="home">
    <section className="vanguard-hero">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-orb orb-one" aria-hidden="true" />
      <div className="hero-orb orb-two" aria-hidden="true" />
      <div className="hero-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="hero-character character-kaiba" aria-hidden="true">K</div>
      <div className="hero-character character-yugi" aria-hidden="true">Y</div>
      <div className="vanguard-content">
        <p className="hero-kicker"><span>✦</span> The One and Only Card Empire</p>
        <h1><span>Collect.</span><span>Command.</span><span>Conquer.</span></h1>
        <p className="vanguard-copy">The private DMO card vault of Kalenski™.<br />Legendary cards. Premium trades. Zero noise.</p>
        <div className="hero-actions"><Link className="hero-cta" to="/marketplace">Enter Card Market <b>↗</b></Link><Link className="hero-link" to="/events">View events <b>→</b></Link></div>
        <div className="hero-metrics"><div><strong>25<span>%</span></strong><small>VIP cart advantage</small></div><div><strong>LIVE</strong><small>Events · Offers · Updates</small></div></div>
      </div>
      <div className="hero-side-label">KALENSKI™<br />CARD EMPIRE®</div>
    </section>
    <section className="section-intro"><p className="eyebrow">ROYAL SELECTION</p><h2>Featured legendary cards</h2><p>Every card belongs to Kalenski’s private collection. One seller. One empire.</p></section>
    <section className="featured-grid">{featured.map((card) => <article className={"royal-card rarity-" + card.rarity.toLowerCase()} key={card.name}>
      <img src={card.image} alt={card.name} /><div><span>{card.rarity}</span><h3>{card.name}</h3><strong>{card.price}</strong></div>
    </article>)}</section>
  </div>;
}

function Events() {
  const { session } = useAuth();
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let channel;
    getEvents().then(setEvents).catch(() => setEvents([]));
    try { channel = subscribeToLiveChanges(() => getEvents().then(setEvents)); } catch { /* Supabase tables may not be installed yet. */ }
    return () => channel?.unsubscribe();
  }, []);
  async function join(id) {
    if (!session) return setNotice("Please sign in before registering.");
    try { await registerForEvent(id, session.user.id); setNotice("Registration confirmed — welcome to the event."); } catch (error) { setNotice(error.message); }
  }
  const examples = [{ id:"demo-1", title:"6-Way Free For All", starts_at:"Coming soon", description:"Police Station · 8000 Life Points · Prize: United We Stand", banlist:{name:"Empire Tournament Banlist"} }];
  return <div className="empire-page"><section className="page-hero"><p className="eyebrow">KALENSKI™ CARD EMPIRE EVENTS</p><h1>Enter the arena</h1><p>Live registrations, tournament banlists and player highlights.</p></section>{notice && <p className="notice">{notice}</p>}
    <div className="event-list">{(events.length ? events : examples).map((event) => <article className="event-panel" key={event.id}><div><p className="eyebrow">{event.banlist?.name ?? "Official Banlist"}</p><h2>{event.title}</h2><p>{event.description}</p><strong>{event.starts_at === "Coming soon" ? event.starts_at : new Date(event.starts_at).toLocaleString()}</strong></div><button className="gold-button" onClick={() => join(event.id)} disabled={event.id === "demo-1"}>Register</button></article>)}</div>
  </div>;
}

function Collection() {
  return <div className="empire-page"><section className="page-hero"><p className="eyebrow">PLAYER VAULT</p><h1>Your collection</h1><p>Purchased cards will be recorded here with rarity, quantity and purchase date.</p></section><div className="empty-vault">Sign in and complete an in-game purchase to start your personal card vault.</div></div>;
}

function News() {
  return <div className="empire-page"><section className="page-hero"><p className="eyebrow">EMPIRE CHRONICLES</p><h1>News & announcements</h1></section><div className="news-grid"><article><span>NEW CARDS</span><h2>Legendary stock arrives soon</h2><p>New Gold and Rainbow cards are being prepared for the royal vault.</p></article><article><span>SHOP UPDATE</span><h2>VIP privilege activated</h2><p>VIP players automatically receive 25% off in their cart.</p></article><article><span>EVENTS</span><h2>The next tournament is near</h2><p>Watch the events page for registration and the official banlist.</p></article></div></div>;
}

function Feedback() {
  const { session } = useAuth();
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!session) return setMessage("Please sign in to leave feedback.");
    try { await addFeedback(session.user.id, text); setText(""); setMessage("Thank you — your feedback was submitted for approval."); } catch (error) { setMessage(error.message); }
  }
  return <div className="empire-page"><section className="page-hero"><p className="eyebrow">THE EMPIRE’S REPUTATION</p><h1>Player feedback</h1><p>Share your experience with Kalenski™ Card Empire®.</p></section><form className="feedback-form" onSubmit={submit}><textarea required value={text} onChange={(e) => setText(e.target.value)} placeholder="Your feedback…" /><button className="gold-button">Submit feedback</button>{message && <p className="notice">{message}</p>}</form></div>;
}

function About() {
  return <div className="empire-page"><section className="about-hero"><p className="eyebrow">THE OWNER. THE COLLECTION. THE EMPIRE.</p><h1>About Kalenski™</h1><p>Kalenski™ is the one and only seller. Every card, bundle and event is personally selected and managed from a private DMO collection.</p><p>This is no public marketplace. It is a royal vault for legendary cards and trusted players.</p></section></div>;
}

function Profile() { return <div className="empire-page"><AccountPanel /></div>; }
function Admin() { return <AdminDashboard />; }

export default function App() {
  return <BrowserRouter><div className="app-layout"><Navbar /><main className="main-content"><Routes>
    <Route path="/" element={<Home />} /><Route path="/marketplace" element={<Marketplace />} /><Route path="/collection" element={<Collection />} />
    <Route path="/events" element={<Events />} /><Route path="/news" element={<News />} /><Route path="/feedback" element={<Feedback />} />
    <Route path="/about" element={<About />} /><Route path="/profile" element={<Profile />} /><Route path="/admin" element={<Admin />} />
  </Routes></main></div></BrowserRouter>;
}
