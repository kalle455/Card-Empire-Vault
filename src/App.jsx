import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import AvailabilityCalendar from "./components/AvailabilityCalendar";
import { useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabase";
import { getEvents, getPotmPlayers, registerForEvent, subscribeToLiveChanges } from "./services/communityApi";
import "./index.css";
import "./enhancements.css";
import "./mobile.css";
import "./refined-ui.css";

const Marketplace = lazy(() => import("./components/Marketplace"));
const AccountPanel = lazy(() => import("./components/AccountPanel"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const NotificationsPanel = lazy(() => import("./components/NotificationsPanel"));
const TradeHub = lazy(() => import("./components/TradeHub"));
const Partners = lazy(() => import("./components/Partners"));
const Community = lazy(() => import("./components/Community"));
const Rules = lazy(() => import("./components/Rules"));

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    let secondFrame;
    const reset = () => {
      root.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      const content = document.querySelector(".main-content");
      if (content) content.scrollTop = 0;
    };

    reset();
    const firstFrame = window.requestAnimationFrame(() => {
      reset();
      secondFrame = window.requestAnimationFrame(reset);
    });
    const settleTimer = window.setTimeout(reset, 160);
    const restoreTimer = window.setTimeout(() => { root.style.scrollBehavior = previousBehavior; }, 230);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(restoreTimer);
      root.style.scrollBehavior = previousBehavior;
    };
  }, [pathname, search]);

  return null;
}

function DuelDiscCursor() {
  const discRef = useRef(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover:hover) and (pointer:fine)");
    if (!finePointer.matches) return undefined;
    let frame;
    const move = (event) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!discRef.current) return;
        discRef.current.style.transform = `translate3d(${event.clientX - 9}px, ${event.clientY - 21}px, 0) rotate(-9deg)`;
        discRef.current.classList.toggle("is-action", Boolean(event.target.closest("a,button,[role='button'],select,summary,label")));
      });
    };
    const down = () => discRef.current?.classList.add("is-pressed");
    const up = () => discRef.current?.classList.remove("is-pressed");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return <div className="duel-disc-pointer" ref={discRef} aria-hidden="true">
    <span className="duel-disc-arm"><i /><i /><i /><i /><i /></span>
    <b className="duel-disc-core" />
    <em className="duel-disc-wing" />
  </div>;
}

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

function DiscordGuard({ children }) {
  const { configured, loading, session, profile, discordConnected, signInWithDiscord } = useAuth();
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    setMessage("");
    setConnecting(true);
    const { error } = await signInWithDiscord();
    if (error) {
      setMessage(error.message);
      setConnecting(false);
    }
  }

  if (!configured || loading) {
    return <main className="discord-market-gate"><p className="vault-overline">VERIFIED MARKET ACCESS</p><h1>Checking Discord…</h1></main>;
  }

  if (session && discordConnected && !profile?.dmo_name) {
    return <main className="discord-market-gate">
      <div className="discord-gate-orbit" aria-hidden="true"><i /><i /><b>✦</b></div>
      <p className="vault-overline">DISCORD VERIFIED · DMO IDENTITY REQUIRED</p>
      <h1>One last<br /><em>step.</em></h1>
      <p>Enter your exact DMO player name so Kalenski knows who is trading. The Card Market unlocks immediately afterward.</p>
      <button type="button" onClick={() => window.location.assign("/profile")}><span>Enter DMO name</span></button>
    </main>;
  }

  if (!session || !discordConnected) {
    return <main className="discord-market-gate">
      <div className="discord-gate-orbit" aria-hidden="true"><i /><i /><b>✦</b></div>
      <p className="vault-overline">KALENSKI™ VERIFIED MARKET ACCESS</p>
      <h1>Discord<br /><em>required.</em></h1>
      <p>Connect Discord before entering the Card Market. Only your Discord ID and username are used — no personal email, messages, friends or servers.</p>
      <button type="button" onClick={connect} disabled={connecting}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 5.3A16 16 0 0 0 15 4l-.5 1.1a14 14 0 0 0-5 0L9 4a16 16 0 0 0-3.9 1.3C2.6 9 1.9 12.5 2.2 16a16 16 0 0 0 4.9 2.5l1.2-1.6a10 10 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.7 1.7 11.3 0l.6.4c-.6.4-1.3.7-1.9.9l1.2 1.6A16 16 0 0 0 23 16c.4-4.1-.7-7.5-4.1-10.7ZM8.7 14.2c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z" /></svg>
        <span>{connecting ? "Connecting…" : "Continue with Discord"}</span>
      </button>
      {message && <p className="discord-gate-error">{message}</p>}
    </main>;
  }

  return children;
}

function Home() {
  const navigate = useNavigate();
  const [transitioning, setTransitioning] = useState(false);
  const fixedSpotlight = [
    { name: "Blue-Eyes White Dragon", ygo_card_id: 89631139, rarity: "Legend" },
    { name: "Dark Magician", ygo_card_id: 46986414, rarity: "Legend" },
    { name: "Pot of Greed", ygo_card_id: 55144522, rarity: "Spell" },
    { name: "Harpie's Feather Duster", ygo_card_id: 18144506, rarity: "Spell" },
    { name: "Mirror Force", ygo_card_id: 44095762, rarity: "Trap" },
  ];
  const [spotlightCards, setSpotlightCards] = useState(fixedSpotlight);

  useEffect(() => {
    let active = true;
    async function loadSpotlight() {
      const { data } = await supabase
        .from("cards")
        .select("id, name, image_url, ygo_card_id, price, rarity, category")
        .in("name", fixedSpotlight.map((card) => card.name));
      if (active) {
        const current = new Map((data ?? []).map((card) => [card.name.toLowerCase(), card]));
        setSpotlightCards(fixedSpotlight.map((card) => ({ ...card, ...(current.get(card.name.toLowerCase()) ?? {}) })));
      }
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
              key={card.id ?? card.name}
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
        </div>
        <button type="button" className="home-section-cta vault-section-cta" onClick={() => enterEmpire("/marketplace")}><span>Enter Card Market</span><b>↗</b></button>
      </section>

      <section className="home-trade-portal">
        <div className="trade-portal-grid" aria-hidden="true" />
        <div className="trade-portal-signal" aria-hidden="true"><i /><i /><i /></div>
        <div className="trade-card-stack" aria-hidden="true">
          <span className="trade-swap-card trade-swap-card-left"><b>OFFER</b></span>
          <span className="trade-swap-card trade-swap-card-right"><b>ACCEPT</b></span>
          <span className="trade-swap-core">⇄</span>
        </div>
        <div className="home-section-copy trade-portal-copy">
          <p className="home-eyebrow">THE PRIVATE EXCHANGE · PLAYER TO PLAYER</p>
          <h2>Make the<br /><em>right trade.</em></h2>
          <p>Choose a card from Cardstock. Present your offer. Kalenski™ accepts, declines or enters a private live negotiation.</p>
          <button type="button" className="trade-portal-cta" onClick={() => enterEmpire("/trade-hub")}><span>Enter Trade Hub</span><b>↗</b></button>
        </div>
        <p className="trade-portal-mark">01 SELECT<br />02 OFFER<br /><b>03 NEGOTIATE</b></p>
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

      <AvailabilityCalendar />



      <section className="home-feedback-zone home-community-zone">
        <div className="community-orbit-art home-orbit-art" aria-hidden="true">
          <span className="orbit-sun" /><i className="orbit-ring orbit-ring-one"><b /></i><i className="orbit-ring orbit-ring-two"><b /></i><i className="orbit-ring orbit-ring-three"><b /></i><i className="orbit-ring orbit-ring-four"><b /></i><i className="orbit-ring orbit-ring-five"><b /></i>
        </div>
        <div className="home-section-copy feedback-copy">
          <p className="home-eyebrow">THE COMMUNITY BUILDS</p>
          <h2>Your voice.<br /><em>Our next move.</em></h2>
          <p>Suggest features, vote in live polls and help shape the next chapter of Card Empire.</p>
          <button type="button" className="feedback-cta" onClick={() => enterEmpire("/community")}><span>Enter Community</span><b>↗</b></button>
        </div>
      </section>

      <section className="home-preview-teasers">
        <header><p className="home-eyebrow">CLASSIFIED · NEXT INSIDE THE EMPIRE</p><h2>A glimpse.<br /><em>Nothing more.</em></h2></header>
        <div className="preview-teaser-grid">
          <article className="preview-teaser teaser-cardstock"><span>01</span><div className="teaser-blur-card" /><p>CARDSTOCK PROTOCOL</p><h3>Something rare is being prepared.</h3></article>
          <article className="preview-teaser teaser-community"><span>02</span><div className="teaser-signal"><i /><i /><i /></div><p>COMMUNITY SIGNAL</p><h3>Your vote will unlock the next transmission.</h3></article>
          <article className="preview-teaser teaser-duel"><span>03</span><div className="teaser-duel-line" /><p>DUEL SYSTEM</p><h3>The arena is recording more than wins.</h3></article>
        </div>
      </section>

      <section className="home-manifesto">
        <p className="home-eyebrow">ABOUT KALENSKI™</p>
        <div>
          <h2>I’m not a card seller<br />like everyone else.<br /><em>I’m the one who makes<br />the card matter.</em></h2>
          <p>Every card has a history. Every trade deserves trust. Kalenski™ Card Empire® is a private Cardstock for collectors who expect more than a listing.</p>
        </div>
        <strong aria-hidden="true">K</strong>
      </section>
    </div>
  );
}

function Events() {
  const { session } = useAuth();
  const [events, setEvents] = useState([]);
  const [potmPlayers, setPotmPlayers] = useState([]);
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
          const format = getEventFormat(event.event_format);
          const registrations = event.registrations?.[0]?.count ?? 0;
          const isFull = format.capacity !== null && registrations >= format.capacity;
          const isCompleted = Boolean(event.winner_id);
          return (
            <article className="event-panel event-command-panel" key={event.id}>
              <span className="event-number">0{index + 1}</span>
              <div className="event-command-copy">
                <p className="eyebrow">CURRENT IN-GAME BANLIST</p>
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                <strong><i>◷</i> {new Date(event.starts_at).toLocaleString()} · {format.label} · {format.teams}</strong>
                <p className="event-registration-status">{isCompleted ? "Event complete" : format.capacity === null ? "Open registration" : registrations + " / " + format.capacity + " players registered"}</p>
                <p className="event-rule-note">The current in-game banlist applies unless this event description explicitly states otherwise.</p>
              </div>
              <button className="event-register-button" disabled={isFull || isCompleted} onClick={() => join(event.id)}><span>{isCompleted ? "Complete" : isFull ? "Event full" : "Register"}</span><b>{isFull || isCompleted ? "—" : "↗"}</b></button>
            </article>
          );
        }) : <div className="empty-vault event-empty"><p className="vault-overline">NO EVENTS YET</p><h2>The arena is quiet.</h2><p>Kalenski™ will publish the next tournament here.</p></div>}
      </div>
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
          <p>Every piece in Cardstock is chosen, listed and traded by Kalenski™ himself. No random inventory. No empty promises. Just a private collection, managed with standards.</p>
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
  return (
    <footer className="empire-footer">
      <div className="empire-footer-top">
        <section className="footer-brand-column">
          <Link to="/" className="footer-brand" aria-label="Kalenski Card Empire home">
            <img src="/card-empire-wordmark.svg" alt="Kalenski Card Empire" />
          </Link>
          <p>Private cards. Direct deals. Cardstock built for players who collect with intention.</p>
          <span className="footer-signal"><i /> Empire system online</span>
        </section>
        <nav className="footer-column" aria-label="Explore the Empire">
          <p>EXPLORE</p>
          <Link to="/marketplace">Card Market <b>↗</b></Link>
          <Link to="/trade-hub">Trade Hub <b>↗</b></Link>
          <Link to="/events">Events <b>↗</b></Link>
          <Link to="/community">Community <b>↗</b></Link>
          <Link to="/partners">Partners <b>↗</b></Link>
          <Link to="/about">About Kalenski <b>↗</b></Link>
        </nav>
        <nav className="footer-column" aria-label="Player links">
          <p>PLAYER ACCESS</p>
          <Link to="/profile">Player profile <b>↗</b></Link>
          <Link to="/messages">Notifications <b>↗</b></Link>
          <Link to="/chats">Live trade chat <b>↗</b></Link>
          <Link to="/rules">Rights &amp; Policies <b>↗</b></Link>
        </nav>
        <section className="footer-column footer-standard">
          <p>THE STANDARD</p>
          <span><i>01</i> Live Cardstock updates</span>
          <span><i>02</i> 25% V.I.P advantage</span>
          <span><i>03</i> Private collector cases</span>
          <span><i>04</i> Current in-game event rules</span>
        </section>
      </div>
      <div className="empire-footer-bottom">
        <p>© 2026 Kalenski™ Card Empire®. All original Empire branding, website design and original content are protected. <Link to="/rules">Rights &amp; Policies</Link></p>
        <p className="footer-fan-note">Unofficial fan experience. Yu-Gi-Oh! and related names belong to their respective owners.</p>
      </div>
    </footer>
  );
}

export default function App() {
  return <BrowserRouter><ScrollToTop /><DuelDiscCursor /><div className="app-layout"><Navbar /><main className="main-content"><Suspense fallback={<section className="route-loading"><i /><span>Opening Card Empire…</span></section>}><Routes>
    <Route path="/" element={<Home />} /><Route path="/marketplace" element={<DiscordGuard><Marketplace /></DiscordGuard>} />
    <Route path="/trade-hub" element={<DiscordGuard><TradeHub /></DiscordGuard>} />
    <Route path="/events" element={<Events />} />
    <Route path="/community" element={<DiscordGuard><Community /></DiscordGuard>} />
    <Route path="/feedback" element={<DiscordGuard><Community /></DiscordGuard>} />
    <Route path="/partners" element={<Partners />} />
    <Route path="/rules" element={<Rules />} />
    <Route path="/about" element={<About />} /><Route path="/profile" element={<Profile />} /><Route path="/messages" element={<NotificationsPanel />} /><Route path="/chats" element={<NotificationsPanel chatOnly />} /><Route path="/admin" element={<Admin />} />
  </Routes></Suspense></main><EmpireFooter /></div></BrowserRouter>;
}
