import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { Component, useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Marketplace from "./components/Marketplace";
import AccountPanel from "./components/AccountPanel";
import AdminDashboard from "./components/AdminDashboard";
import NotificationsPanel from "./components/NotificationsPanel";
import BanlistGallery from "./components/BanlistGallery";
import { useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabase";
import { addFeedback, getEvents, getPotmPlayers, registerForEvent, subscribeToLiveChanges } from "./services/communityApi";
import "./index.css";

function Home() {
  const navigate = useNavigate();
  const [transitioning, setTransitioning] = useState(false);
  const [spotlightCards, setSpotlightCards] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadSpotlight() {
      const { data } = await supabase
        .from("cards")
        .select("id, name, image_url, price, rarity, category")
        .gt("quantity", 0)
        .order("price", { ascending: false })
        .limit(5);
      if (active) setSpotlightCards(data ?? []);
    }
    loadSpotlight();
    const channel = supabase
      .channel("home-vault-spotlight")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, loadSpotlight)
      .subscribe();
    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, []);

  function enterEmpire(path) {
    if (transitioning) return;
    setTransitioning(true);
    window.setTimeout(() => navigate(path), 560);
  }

  return (
    <div className={"home cinematic-home " + (transitioning ? "is-transitioning" : "")}>
      <div className="home-route-transition" aria-hidden="true"><span>K</span></div>

      <section className="vanguard-hero">
        <img className="hero-film hero-rooftop-art" src="/kalenski-rooftop-hero.png" alt="" />
        <div className="hero-cloud hero-cloud-one" aria-hidden="true" />
        <div className="hero-cloud hero-cloud-two" aria-hidden="true" />
        <div className="hero-film-shade" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-scanline" aria-hidden="true" />
        <div className="hero-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <div className="hero-index" aria-hidden="true"><span>01</span><i /><small>KALENSKI™<br />CARD EMPIRE®</small></div>
        <div className="vanguard-content">
          <p className="hero-kicker"><span>✦</span> The one and only card empire</p>
          <h1><span>Collect.</span><span>Command.</span><span>Conquer.</span></h1>
          <p className="vanguard-copy">A private vault for players who collect with intention.<br />Legendary cards. Premium trades. Zero noise.</p>
          <div className="hero-actions">
            <button type="button" className="hero-cta" onClick={() => enterEmpire("/marketplace")}><span>Enter Card Market</span><b>↗</b></button>
            <button type="button" className="hero-link" onClick={() => enterEmpire("/events")}>View events <b>→</b></button>
          </div>
          <div className="hero-metrics">
            <div><strong>25<span>%</span></strong><small>VIP advantage</small></div>
            <div><strong>LIVE</strong><small>Vault updates</small></div>
            <div><strong>01</strong><small>One seller</small></div>
          </div>
        </div>
        <div className="hero-side-label">SCROLL TO<br />ENTER THE EMPIRE <b>↓</b></div>
      </section>

      <section className="home-vault-passage">
        <div className="home-section-copy home-vault-copy">
          <p className="home-eyebrow">THE PRIVATE SELECTION · 01—05</p>
          <h2>Turn over<br /><em>the impossible.</em></h2>
          <p>The five most valuable cards currently inside the vault. Hover to reveal them — every one is ready for its next owner.</p>
        </div>
        <div className={"vault-spotlight-stage" + (spotlightCards.length ? "" : " is-empty")}>
          {spotlightCards.map((card, index) => (
            <button
              className={"vault-spotlight-card card-position-" + index}
              key={card.id}
              type="button"
              onClick={() => enterEmpire("/marketplace")}
              aria-label={"Reveal " + card.name + " in Card Market"}
            >
              <span className="spotlight-card-shell">
                <span className="spotlight-card-back" aria-hidden="true"><i /><b>K</b></span>
                <span className="spotlight-card-front">
                  {card.image_url && <img src={card.image_url} alt="" />}
                  <span className="spotlight-card-info"><b>{card.name}</b><small>{Number(card.price).toLocaleString()} G · {card.rarity}</small></span>
                </span>
              </span>
            </button>
          ))}
          {!spotlightCards.length && <div className="spotlight-vault-empty"><span>THE VAULT IS PREPARING</span><p>Cards will appear here as soon as Kalenski™ adds them.</p></div>}
        </div>
        <button type="button" className="home-section-cta vault-section-cta" onClick={() => enterEmpire("/marketplace")}><span>Enter Card Market</span><b>↗</b></button>
      </section>

      <section className="home-arena">
        <div className="arena-grid" aria-hidden="true" />
        <div className="arena-light arena-light-left" aria-hidden="true" />
        <div className="arena-light arena-light-right" aria-hidden="true" />
        <div className="arena-duelist arena-duelist-left" aria-hidden="true"><i /></div>
        <div className="arena-duelist arena-duelist-right" aria-hidden="true"><i /></div>
        <div className="arena-impact" aria-hidden="true"><i /><i /><i /></div>
        <div className="home-section-copy arena-copy">
          <p className="home-eyebrow">THE EMPIRE TOURNAMENTS · LIVE</p>
          <h2>Events<br /><em>start here.</em></h2>
          <p>Two players. One arena. Your next story is waiting for a seat across the table.</p>
          <button type="button" className="arena-cta" onClick={() => enterEmpire("/events")}><span>Enter the arena</span><b>→</b></button>
        </div>
        <p className="arena-side-mark">DUEL<br />SYSTEM<br /><b>ACTIVE</b></p>
      </section>



      <section className="home-feedback-zone">
        <div className="feedback-orbit" aria-hidden="true"><i /><i /><i /><b>✦</b></div>
        <div className="home-section-copy feedback-copy">
          <p className="home-eyebrow">THE EMPIRE REMEMBERS</p>
          <h2>Leave your<br /><em>mark.</em></h2>
          <p>Every deal, event and conversation leaves a trace. Tell the Empire how it felt.</p>
          <button type="button" className="feedback-cta" onClick={() => enterEmpire("/feedback")}><span>Share feedback</span><b>↗</b></button>
        </div>
      </section>

      <section className="home-manifesto">
        <p className="home-eyebrow">ABOUT KALENSKI™</p>
        <div>
          <h2>I’m not a card seller<br />like everyone else.<br /><em>I’m the one who makes<br />the card matter.</em></h2>
          <p>Every card has a history. Every trade deserves trust. Kalenski™ Card Empire® is a private vault for collectors who expect more than a listing.</p>
        </div>
        <strong aria-hidden="true">K</strong>
      </section>
    </div>
  );
}

class VisualBanlistBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (this.state.failed) {
      return <div className="visual-banlist-fallback"><strong>Banlist could not load visually.</strong><span>Close and reopen it once — the event page stays available.</span></div>;
    }
    return this.props.children;
  }
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
                {hasBanlistCards && <section className="event-banlist">
                  <button type="button" className="event-banlist-toggle" onClick={() => setOpenBanlists((current) => ({ ...current, [event.id]: !current[event.id] }))}>
                    {openBanlists[event.id] ? "Hide visual banlist" : "Open visual banlist"}
                  </button>
                  {openBanlists[event.id] && <VisualBanlistBoundary resetKey={event.id}><BanlistGallery banlist={banlist} /></VisualBanlistBoundary>}
                </section>}
              </div>
              <button className="gold-button" onClick={() => join(event.id)}>Register</button>
            </article>
          );
        }) : <div className="empty-vault"><p className="vault-overline">NO EVENTS YET</p><h2>No events scheduled yet.</h2><p>Kalenski™ will publish the next tournament here.</p></div>}
      </div>
    </div>
  );
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
    <Route path="/events" element={<Events />} /><Route path="/feedback" element={<Feedback />} />
    <Route path="/about" element={<About />} /><Route path="/profile" element={<Profile />} /><Route path="/messages" element={<NotificationsPanel />} /><Route path="/chats" element={<NotificationsPanel chatOnly />} /><Route path="/admin" element={<Admin />} />
  </Routes></main></div></BrowserRouter>;
}
