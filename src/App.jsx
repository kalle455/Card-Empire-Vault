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
import { addFeedback, getEvents, getPotmPlayers, getPublishedFeedback, registerForEvent, subscribeToFeedbackChanges, subscribeToLiveChanges } from "./services/communityApi";
import "./index.css";

const eventFormats = {
  five_way_ffa: { label: "5-WAY FFA", teams: "5 players", capacity: 5 },
  six_way_ffa: { label: "6-WAY FFA", teams: "6 players", capacity: 6 },
  three_way_ffa: { label: "3-WAY FFA", teams: "2v2v2 · 6 players", capacity: 6 },
  four_way_ffa: { label: "4-WAY FFA", teams: "2v2v2v2 · 8 players", capacity: 8 },
  open: { label: "OPEN FORMAT", teams: "No player limit", capacity: null },
};

function getEventFormat(format) {
  return eventFormats[format] ?? eventFormats.open;
}

function Home() {
  const navigate = useNavigate();
  const [transitioning, setTransitioning] = useState(false);
  const [spotlightCards, setSpotlightCards] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadSpotlight() {
      const { data } = await supabase
        .from("cards")
        .select("id, name, image_url, ygo_card_id, price, rarity, category")
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

  function cardImage(card) {
    return card?.ygo_card_id
      ? "https://images.ygoprodeck.com/images/cards/" + card.ygo_card_id + ".jpg"
      : card?.image_url;
  }

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

      </section>

      <section className="home-vault-passage">
        <div className="home-section-copy home-vault-copy">
          <p className="home-eyebrow">THE PRIVATE SELECTION · 01—05</p>
          <h2>Turn over<br /><em>the impossible.</em></h2>
          <p>Maybe your next hand.</p>
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
                  {cardImage(card) && <img src={cardImage(card)} alt="" decoding="async" />}
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
      await registerForEvent(id);
      setNotice("Registration confirmed — welcome to the event.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  function showSchedule() {
    document.getElementById("event-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="empire-page event-world">
      <section className="event-stage-hero">
        <div className="event-stage-grid" aria-hidden="true" />
        <div className="event-stage-beam beam-a" aria-hidden="true" />
        <div className="event-stage-beam beam-b" aria-hidden="true" />
        <div className="event-stage-player stage-player-one" aria-hidden="true"><i /><b /></div>
        <div className="event-stage-player stage-player-two" aria-hidden="true"><i /><b /></div>
        <div className="event-stage-core" aria-hidden="true"><i /><i /><i /></div>
        <div className="event-stage-copy">
          <p className="stage-kicker"><span>✦</span> KALENSKI™ TOURNAMENT SYSTEM</p>
          <h1>Enter<br />the <em>arena.</em></h1>
          <p>Live registrations. Official banlists. No second chances once the duel begins.</p>
          <button type="button" onClick={showSchedule}><span>View active events</span><b>↓</b></button>
        </div>
        <div className="event-stage-stats" aria-label="Event status"><span><b>LIVE</b><small>System status</small></span><span><b>{String(events.length).padStart(2, "0")}</b><small>Active events</small></span></div>
        <p className="event-stage-mark">DUEL<br />ARENA<br /><b>01</b></p>
      </section>

      {potmPlayers.length > 0 && <section className="potm-event-banner event-potm-banner"><div><p className="eyebrow">PLAYER OF THE TOURNAMENT</p><strong>✦ {potmPlayers.map((player) => player.username).join(" · ")}</strong></div><span>Recognized in the arena</span></section>}
      {notice && <p className="notice event-notice">{notice}</p>}

      <section className="event-schedule" id="event-schedule">
        <div><p className="schedule-kicker">UPCOMING BATTLES</p><h2>Claim your<br /><em>place.</em></h2></div>
        <p>Every event is managed directly inside the Empire. Open the banlist, read the format and enter only when your deck is ready.</p>
      </section>
      <div className="event-list event-command-list">
        {events.length ? events.map((event, index) => {
          const banlist = event.banlist;
          const hasBanlistCards = (banlist?.banned_cards?.length ?? 0) + (banlist?.limited_cards?.length ?? 0) + ((!banlist?.banned_cards?.length && !banlist?.limited_cards?.length) ? (banlist?.card_names?.length ?? 0) : 0) > 0;
          const format = getEventFormat(event.event_format);
          const registrations = event.registrations?.[0]?.count ?? 0;
          const isFull = format.capacity !== null && registrations >= format.capacity;
          const isCompleted = Boolean(event.winner_id);
          return (
            <article className="event-panel event-command-panel" key={event.id}>
              <span className="event-number">0{index + 1}</span>
              <div className="event-command-copy">
                <p className="eyebrow">{banlist?.name ?? "Official Banlist"}</p>
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                <strong><i>◷</i> {new Date(event.starts_at).toLocaleString()} · {format.label} · {format.teams}</strong>
                <p className="event-registration-status">{isCompleted ? "Event complete" : format.capacity === null ? "Open registration" : registrations + " / " + format.capacity + " players registered"}</p>
                {hasBanlistCards && <section className="event-banlist">
                  <button type="button" className="event-banlist-toggle" onClick={() => setOpenBanlists((current) => ({ ...current, [event.id]: !current[event.id] }))}>
                    {openBanlists[event.id] ? "Close visual banlist" : "Inspect visual banlist"}
                  </button>
                  {openBanlists[event.id] && <VisualBanlistBoundary resetKey={event.id}><BanlistGallery banlist={banlist} /></VisualBanlistBoundary>}
                </section>}
              </div>
              <button className="event-register-button" disabled={isFull || isCompleted} onClick={() => join(event.id)}><span>{isCompleted ? "Complete" : isFull ? "Event full" : "Register"}</span><b>{isFull || isCompleted ? "—" : "↗"}</b></button>
            </article>
          );
        }) : <div className="empty-vault event-empty"><p className="vault-overline">NO EVENTS YET</p><h2>The arena is quiet.</h2><p>Kalenski™ will publish the next tournament here.</p></div>}
      </div>
    </div>
  );
}

function Feedback() {
  const { session } = useAuth();
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    let active = true;
    const loadFeedback = () => getPublishedFeedback().then((data) => { if (active) setEntries(data); }).catch(() => { if (active) setEntries([]); });
    loadFeedback();
    const channel = subscribeToFeedbackChanges(loadFeedback);
    return () => { active = false; channel.unsubscribe(); };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!session) return setMessage("Please sign in to leave feedback.");
    try {
      await addFeedback(session.user.id, text.trim());
      setText("");
      setMessage("Transmission received — it is now visible in the Empire.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="empire-page feedback-world">
      <section className="feedback-stage">
        <div className="feedback-stage-lines" aria-hidden="true" />
        <div className="feedback-stage-seal" aria-hidden="true"><i /><i /><i /><b>✦</b></div>
        <div className="feedback-stage-copy">
          <p className="stage-kicker"><span>✦</span> PRIVATE EMPIRE TRANSMISSION</p>
          <h1>Make it<br /><em>count.</em></h1>
          <p>Every experience matters. Tell the Empire what should stay, improve or become legendary.</p>
        </div>
        <p className="feedback-stage-mark">VOICE<br />OF THE<br /><b>PLAYER</b></p>
      </section>
      <section className="feedback-console-wrap">
        <form className="feedback-form feedback-console" onSubmit={submit}>
          <header><div><p>PLAYER TRANSMISSION</p><h2>Leave your mark.</h2></div><span><i />Secure line</span></header>
          <label htmlFor="empire-feedback">Your message</label>
          <textarea id="empire-feedback" required value={text} onChange={(event) => setText(event.target.value)} placeholder="How did the Empire feel?" />
          <footer><small>Your feedback is saved and displayed directly in the Empire.</small><button className="feedback-submit-button"><span>Send transmission</span><b>↗</b></button></footer>
          {message && <p className="notice feedback-notice">{message}</p>}
        </form>
        <aside className="feedback-pledge">
          <span>01</span><p>NO NOISE</p><h3>Clear deals.<br />Direct answers.</h3>
          <span>02</span><p>REAL PEOPLE</p><h3>Every message<br />gets read.</h3>
          <span>03</span><p>BETTER EMPIRE</p><h3>Your feedback<br />shapes the vault.</h3>
        </aside>
      </section>
      <section className="feedback-wall">
        <header><div><p className="stage-kicker"><span>✦</span> LIVE EMPIRE RECORD</p><h2>Voices from<br /><em>the vault.</em></h2></div><span>{entries.length ? String(entries.length).padStart(2, "0") + " latest transmissions" : "Awaiting the first transmission"}</span></header>
        <div className="feedback-wall-grid">
          {entries.map((entry, index) => <article key={entry.id} className={"feedback-entry entry-" + (index % 3)}>
            <span>0{index + 1}</span>
            <p>“{entry.message}”</p>
            <small>EMPIRE PLAYER · {new Date(entry.created_at).toLocaleDateString()}</small>
          </article>)}
          {!entries.length && <article className="feedback-wall-empty"><p>The first player transmission will appear here.</p></article>}
        </div>
      </section>
    </div>
  );
}

function About() {
  return (
    <div className="empire-page about-world">
      <section className="about-stage">
        <div className="about-stage-grain" aria-hidden="true" />
        <div className="about-stage-monogram" aria-hidden="true">K</div>
        <div className="about-stage-copy">
          <p className="stage-kicker"><span>✦</span> THE OWNER · THE COLLECTION · THE EMPIRE</p>
          <h1>I’m not a card seller<br />like everyone else.</h1>
          <p className="about-lead">I’m the one who knows that a card is never just a card.</p>
          <p>Every piece in this vault is chosen, listed and traded by Kalenski™ himself. No random inventory. No empty promises. Just a private collection, managed with standards.</p>
        </div>
        <div className="about-stage-stamp"><small>EST.</small><b>K</b><small>CARD EMPIRE®</small></div>
      </section>
      <section className="about-principles">
        <p className="schedule-kicker">THE KALENSKI™ STANDARD</p>
        <div className="about-principle-grid">
          <article><span>01</span><h2>Every card<br />has a story.</h2><p>Condition, history and character matter. The right card never feels ordinary.</p></article>
          <article><span>02</span><h2>Every deal<br />has a name.</h2><p>You don’t trade with a faceless platform. You trade directly with the Empire.</p></article>
          <article><span>03</span><h2>Every player<br />has a place.</h2><p>Collectors, customers and tournament players all enter through the same gate.</p></article>
        </div>
      </section>
      <section className="about-closing"><p>THIS ISN’T A STORE.</p><h2>This is<br /><em>the Empire.</em></h2><span>Kalenski™ Card Empire®</span></section>
    </div>
  );
}

function Profile() { return <div className="empire-page"><AccountPanel /></div>; }
function Admin() { return <AdminDashboard />; }

function EmpireFooter() {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <footer className="empire-footer">
      <div className="empire-footer-top">
        <section className="footer-brand-column">
          <Link to="/" className="footer-brand"><span>Kalenski™</span><strong>Card Empire®</strong></Link>
          <p>Private cards. Direct deals. A vault built for players who collect with intention.</p>
          <span className="footer-signal"><i /> Empire system online</span>
        </section>
        <nav className="footer-column" aria-label="Explore the Empire">
          <p>EXPLORE</p>
          <Link to="/marketplace">Card Market <b>↗</b></Link>
          <Link to="/events">Events <b>↗</b></Link>
          <Link to="/feedback">Feedback <b>↗</b></Link>
          <Link to="/about">About Kalenski <b>↗</b></Link>
        </nav>
        <nav className="footer-column" aria-label="Player links">
          <p>PLAYER ACCESS</p>
          <Link to="/profile">Player profile <b>↗</b></Link>
          <Link to="/messages">Notifications <b>↗</b></Link>
          <Link to="/chats">Live trade chat <b>↗</b></Link>
          <Link to="/admin">Empire Admin <b>↗</b></Link>
        </nav>
        <section className="footer-column footer-standard">
          <p>THE STANDARD</p>
          <span><i>01</i> Live vault updates</span>
          <span><i>02</i> 25% V.I.P advantage</span>
          <span><i>03</i> Private collector cases</span>
          <span><i>04</i> Official event banlists</span>
        </section>
      </div>
      <div className="empire-footer-bottom">
        <p>© 2026 Kalenski™ Card Empire®. All original Empire branding, website design and original content are protected.</p>
        <button type="button" className="footer-archive-button" onClick={() => setArchiveOpen(true)}><span>✦</span> Holdings archive</button>
        <p className="footer-fan-note">Unofficial fan experience. Yu-Gi-Oh! and related names belong to their respective owners.</p>
      </div>
      {archiveOpen && <div className="archive-overlay" role="dialog" aria-modal="true" aria-label="Classified Empire archive" onClick={() => setArchiveOpen(false)}>
        <article className="archive-card" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="archive-close" onClick={() => setArchiveOpen(false)} aria-label="Close archive">×</button>
          <p>CLASSIFIED FILE · K-01</p>
          <h2>Parent company<br /><em>confirmed.</em></h2>
          <strong>KALENSKI HOLDINGS → KAIBACORP</strong>
          <span>In the fictional Empire universe, Kalenski Holdings quietly owns the Kaiba Company. Every Duel Disc report ends up in the same vault.</span>
          <div className="archive-integrity-note"><b>INTEGRITY PROTOCOL</b><span>Anyone trying to scam the Empire is not chased — their access ends, the attempt is archived, and the gate stays closed.</span></div>
          <small>Fictional fan-lore easter egg. No official affiliation or endorsement.</small>
          <button type="button" className="archive-seal" onClick={() => setArchiveOpen(false)}>Seal archive</button>
        </article>
      </div>}
    </footer>
  );
}

export default function App() {
  return <BrowserRouter><div className="app-layout"><Navbar /><main className="main-content"><Routes>
    <Route path="/" element={<Home />} /><Route path="/marketplace" element={<Marketplace />} />
    <Route path="/events" element={<Events />} />
<Route path="/feedback" element={<Feedback />} />
    <Route path="/about" element={<About />} /><Route path="/profile" element={<Profile />} /><Route path="/messages" element={<NotificationsPanel />} /><Route path="/chats" element={<NotificationsPanel chatOnly />} /><Route path="/admin" element={<Admin />} />
  </Routes></main><EmpireFooter /></div></BrowserRouter>;
}
