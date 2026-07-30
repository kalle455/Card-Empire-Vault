import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Marketplace from "./components/Marketplace";
import AccountPanel from "./components/AccountPanel";
import AdminDashboard from "./components/AdminDashboard";
import NotificationsPanel from "./components/NotificationsPanel";
import BanlistGallery from "./components/BanlistGallery";
import { useAuth } from "./context/AuthContext";
import { addFeedback, getEvents, getPotmPlayers, registerForEvent, subscribeToLiveChanges } from "./services/communityApi";
import "./index.css";

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
  </div>;
}

function Events() {
  const { session } = useAuth();
  const [events, setEvents] = useState([]);
  const [potmPlayers, setPotmPlayers] = useState([]);
  const [openBanlists, setOpenBanlists] = useState({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let channel;
    const loadEvents = () => getEvents().then(setEvents).catch(() => setEvents([]));
    loadEvents();
    getPotmPlayers().then(setPotmPlayers).catch(() => setPotmPlayers([]));
    try { channel = subscribeToLiveChanges(loadEvents); } catch { /* Supabase tables may not be installed yet. */ }
    return () => channel?.unsubscribe();
  }, []);

  async function join(id) {
    if (!session) return setNotice("Please sign in before registering.");
    try {
      await registerForEvent(id, session.user.id);
      setNotice("Registration confirmed — welcome to the event.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <div className="empire-page">
      <section className="page-hero">
        <p className="eyebrow">KALENSKI™ CARD EMPIRE EVENTS</p>
        <h1>Enter the arena</h1>
        <p>Live registrations, tournament banlists and player highlights.</p>
      </section>
      {potmPlayers.length > 0 && <section className="potm-event-banner"><div><p className="eyebrow">PLAYER OF THE TOURNAMENT</p><strong>✦ {potmPlayers.map((player) => player.username).join(" · ")}</strong></div><span>Honored at every upcoming Empire event</span></section>}
      {notice && <p className="notice">{notice}</p>}
      <div className="event-list">
        {events.length ? events.map((event) => {
          const banlist = event.banlist;
          const hasBanlistCards = (banlist?.banned_cards?.length ?? 0) + (banlist?.limited_cards?.length ?? 0) + ((!banlist?.banned_cards?.length && !banlist?.limited_cards?.length) ? (banlist?.card_names?.length ?? 0) : 0) > 0;
          return (
            <article className="event-panel" key={event.id}>
              <div>
                <p className="eyebrow">{banlist?.name ?? "Official Banlist"}</p>
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                <strong>{new Date(event.starts_at).toLocaleString()}</strong>
                {hasBanlistCards && <details className="event-banlist" onToggle={(toggleEvent) => setOpenBanlists((current) => ({ ...current, [event.id]: toggleEvent.currentTarget.open }))}>
                  <summary>Open visual banlist</summary>
                  {openBanlists[event.id] && <BanlistGallery banlist={banlist} />}
                </details>}
              </div>
              <button className="gold-button" onClick={() => join(event.id)}>Register</button>
            </article>
          );
        }) : <div className="empty-vault"><p className="vault-overline">NO EVENTS YET</p><h2>No events scheduled yet.</h2><p>Kalenski™ will publish the next tournament here.</p></div>}
      </div>
    </div>
  );
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
    <Route path="/" element={<Home />} /><Route path="/marketplace" element={<Marketplace />} />
    <Route path="/events" element={<Events />} /><Route path="/news" element={<News />} /><Route path="/feedback" element={<Feedback />} />
    <Route path="/about" element={<About />} /><Route path="/profile" element={<Profile />} /><Route path="/messages" element={<NotificationsPanel />} /><Route path="/chats" element={<NotificationsPanel chatOnly />} /><Route path="/admin" element={<Admin />} />
  </Routes></main></div></BrowserRouter>;
}
