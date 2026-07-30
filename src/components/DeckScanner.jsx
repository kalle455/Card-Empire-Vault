import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./DeckScanner.css";

const FALLBACK_BANLIST = {
  id: "king-of-1",
  name: "KING OF 1",
  banned_cards: [
    "Dark Magician of Chaos", "Witch of the Black Forest", "Woodland Sprite",
    "Blue-Eyes Ultimate Dragon", "Sasuke Samurai #4", "Snipe Hunter",
    "Tribe-Infecting Virus", "Pot of Greed", "Graceful Charity", "Monster Reborn",
    "Change of Heart", "Dark Hole", "Raigeki", "Heavy Storm",
    "Harpie's Feather Duster", "Painful Choice", "Final Countdown", "Serial Spell",
    "Mirror Force", "Torrential Tribute", "Rivalry of Warlords",
  ],
  limited_cards: [
    "Jinzo", "Caius the Shadow Monarch", "Raiza the Storm Monarch",
    "Mobius the Frost Monarch", "Horus the Black Flame Dragon LV8",
    "Sacred Phoenix of Nephthys", "Thestalos the Firestorm Monarch",
    "Zaborg the Thunder Monarch", "Granmarg the Rock Monarch",
  ],
};

function statusCopy(status) {
  if (status === "legal") return "Deck cleared";
  if (status === "illegal") return "Deck needs changes";
  return "Deck needs a closer look";
}

export default function DeckScanner() {
  const { session } = useAuth();
  const [banlists, setBanlists] = useState([]);
  const [banlistId, setBanlistId] = useState(FALLBACK_BANLIST.id);
  const [deckText, setDeckText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [report, setReport] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadBanlists() {
      const { data, error } = await supabase
        .from("banlists")
        .select("id, name, banned_cards, limited_cards, card_names")
        .order("name");
      if (!active || error || !data?.length) return;
      setBanlists(data);
      const official = data.find((item) => String(item.name).toLowerCase() === "king of 1");
      setBanlistId((official ?? data[0]).id);
    }
    loadBanlists();
    return () => { active = false; };
  }, []);

  const selectedBanlist = useMemo(
    () => banlists.find((item) => item.id === banlistId) ?? FALLBACK_BANLIST,
    [banlists, banlistId],
  );

  function selectImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Please use a JPG, PNG or WebP screenshot.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("Please keep the screenshot below 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result ?? ""));
      setImageName(file.name);
      setNotice("");
    };
    reader.readAsDataURL(file);
  }

  async function analyzeDeck(event) {
    event.preventDefault();
    if (!session) {
      setNotice("Please sign in before using the Deck Scanner.");
      return;
    }
    if (!deckText.trim() && !imageDataUrl) {
      setNotice("Paste a deck list or add one deck screenshot.");
      return;
    }

    setLoading(true);
    setNotice("");
    setReport(null);
    try {
      const response = await fetch("/api/deck-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          deckText,
          imageDataUrl,
          banlist: {
            name: selectedBanlist.name,
            banned_cards: selectedBanlist.banned_cards ?? [],
            limited_cards: selectedBanlist.limited_cards ?? [],
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "The scanner could not complete this check.");
      setReport(data);
    } catch (error) {
      setNotice(error.message ?? "The scanner could not complete this check.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="deck-scanner-page">
      <section className="deck-scanner-hero">
        <div className="deck-scanner-grid" aria-hidden="true" />
        <div className="deck-scanner-orbit orbit-one" aria-hidden="true" />
        <div className="deck-scanner-orbit orbit-two" aria-hidden="true" />
        <div className="deck-scanner-copy">
          <p className="scanner-kicker"><span>✦</span> KALENSKI™ DECK INTELLIGENCE</p>
          <h1>Know your<br /><em>next move.</em></h1>
          <p>Upload a deck screenshot or paste your list. The Empire checks your cards against the active banlist, then gives your strategy a straight answer.</p>
        </div>
        <p className="deck-scanner-mark">DECK<br />SCAN<br /><b>01</b></p>
      </section>

      <section className="deck-scanner-console">
        <form className="deck-scanner-form" onSubmit={analyzeDeck}>
          <header>
            <div>
              <p>DECK TRANSMISSION</p>
              <h2>Scan the build.</h2>
            </div>
            <span><i /> Secure analysis</span>
          </header>

          <div className="deck-scanner-controls">
            <label>
              <span>Active banlist</span>
              <select value={banlistId} onChange={(event) => setBanlistId(event.target.value)}>
                {banlists.length
                  ? banlists.map((banlist) => <option key={banlist.id} value={banlist.id}>{banlist.name}</option>)
                  : <option value={FALLBACK_BANLIST.id}>KING OF 1</option>}
              </select>
            </label>
            <label className="deck-upload">
              <span>Deck screenshot <small>optional</small></span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
              <b>{imageName ? imageName : "Choose image"}</b>
            </label>
          </div>

          <label className="deck-textarea-label" htmlFor="deck-list">
            <span>Deck list <small>paste names, one per line</small></span>
            <textarea
              id="deck-list"
              value={deckText}
              onChange={(event) => setDeckText(event.target.value)}
              placeholder={"1 Jinzo\n1 Pot of Greed\n2 Caius the Shadow Monarch"}
            />
          </label>

          <footer>
            <p>Official legality comes from the selected Kalenski™ banlist. AI recommendations are a second opinion, not an official tournament ruling.</p>
            <button type="submit" disabled={loading}>
              <span>{loading ? "Analyzing deck…" : "Run deck scan"}</span><b>↗</b>
            </button>
          </footer>
          {notice && <p className="deck-scanner-notice">{notice}</p>}
        </form>

        <aside className="deck-scanner-side">
          <span>01</span><p>RULE CHECK</p><h3>Banned and<br />limited cards.</h3>
          <span>02</span><p>AI REVIEW</p><h3>Strengths and<br />weak points.</h3>
          <span>03</span><p>PLAYER FIRST</p><h3>Your deck stays<br />your deck.</h3>
        </aside>
      </section>

      {report && <section className={"deck-report status-" + report.status}>
        <header className="deck-report-head">
          <div>
            <p className="scanner-kicker"><span>✦</span> SCAN COMPLETE · {report.banlistName}</p>
            <h2>{statusCopy(report.status)}</h2>
          </div>
          <strong>{report.status === "legal" ? "LEGAL" : report.status === "illegal" ? "ILLEGAL" : "REVIEW"}</strong>
        </header>

        <div className="deck-report-metrics">
          <span><b>{report.deck?.totalCards ?? 0}</b><small>cards found</small></span>
          <span><b>{report.deck?.uniqueCards ?? 0}</b><small>unique cards</small></span>
          <span><b>{report.violations?.banned?.length ?? 0}</b><small>banned cards</small></span>
          <span><b>{report.violations?.limited?.length ?? 0}</b><small>limited errors</small></span>
        </div>

        <div className="deck-report-grid">
          <article className="deck-rule-report">
            <p>OFFICIAL BANLIST RESULT</p>
            {report.violations?.banned?.length > 0 && <div className="deck-violation banned">
              <strong>Banned</strong>
              {report.violations.banned.map((card) => <span key={card.name}>{card.name} <b>×{card.count}</b></span>)}
            </div>}
            {report.violations?.limited?.length > 0 && <div className="deck-violation limited">
              <strong>Limited — one copy allowed</strong>
              {report.violations.limited.map((card) => <span key={card.name}>{card.name} <b>×{card.count}</b></span>)}
            </div>}
            {!report.violations?.banned?.length && !report.violations?.limited?.length && <div className="deck-rule-clear"><b>✓</b><span>No banned cards or limited-card copy errors were found.</span></div>}
          </article>

          <article className="deck-ai-report">
            <p>EMPIRE AI REVIEW</p>
            <h3>{report.analysis?.summary ?? "The scan is ready."}</h3>
            <div className="deck-insights">
              {report.analysis?.strengths?.length > 0 && <div><b>Strengths</b>{report.analysis.strengths.map((item) => <span key={item}>✦ {item}</span>)}</div>}
              {report.analysis?.cautions?.length > 0 && <div><b>Watch out</b>{report.analysis.cautions.map((item) => <span key={item}>• {item}</span>)}</div>}
              {report.analysis?.suggestions?.length > 0 && <div><b>Try next</b>{report.analysis.suggestions.map((item) => <span key={item}>→ {item}</span>)}</div>}
            </div>
            {report.aiUnavailable && <small className="deck-ai-note">Rule check completed. AI review was unavailable for this scan.</small>}
          </article>
        </div>
      </section>}
    </main>
  );
}
