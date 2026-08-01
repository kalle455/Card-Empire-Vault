import { useEffect, useState } from "react";
import "./Partners.css";

const issues = [
  { number: "001", title: "Domino Pulse · Issue 001", url: "https://heyzine.com/flip-book/a3c1161398.html", accent: "violet" },
  { number: "002", title: "Domino Pulse · Issue 002", url: "https://heyzine.com/flip-book/4dee3cbbcf.html#page/1", accent: "emerald" },
];

export default function Partners() {
  const [activeIssue, setActiveIssue] = useState(null);

  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") setActiveIssue(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return <main className="partners-page">
    <section className="partners-hero">
      <div className="partner-signal" aria-hidden="true"><i /><i /><i /></div>
      <p className="vault-overline">CARD EMPIRE · OFFICIAL PARTNERS</p>
      <img src="/domino-pulse-logo.png" alt="Domino Pulse" />
      <h1>The pulse of<br /><em>the DMO world.</em></h1>
      <p>Magazine, analysis and news covering everything related to DMO — presented inside Card Empire as an interactive reading room.</p>
      <button type="button" onClick={() => setActiveIssue(issues[0])}>Read the latest issue <span>↗</span></button>
    </section>

    <section className="partner-editorial">
      <header><p className="vault-overline">THE DOMINO PULSE READING ROOM</p><h2>Two issues.<br /><em>Every page alive.</em></h2></header>
      <div className="magazine-grid">
        {issues.map((issue) => <article className={"magazine-issue " + issue.accent} key={issue.number}>
          <button type="button" className="magazine-cover" onClick={() => setActiveIssue(issue)} aria-label={"Open " + issue.title}>
            <span className="magazine-spine">DOMINO PULSE</span>
            <span className="magazine-pulse" aria-hidden="true"><i /><i /><i /></span>
            <small>DMO CULTURE · NEWS · META</small>
            <strong>ISSUE<br />{issue.number}</strong>
            <em>READ NOW ↗</em>
          </button>
          <div><span>INTERACTIVE FLIPBOOK</span><h3>{issue.title}</h3><p>Turn pages, zoom into articles and enter fullscreen without leaving the Empire.</p><button type="button" onClick={() => setActiveIssue(issue)}>Open magazine</button></div>
        </article>)}
      </div>
    </section>

    <section className="partner-capabilities">
      <article><span>01</span><h3>DMO News</h3><p>Player stories, developments and the moments shaping the game.</p></article>
      <article><span>02</span><h3>Meta & Culture</h3><p>Deck thinking, community voices and competitive context in one publication.</p></article>
      <article><span>03</span><h3>Real Page Turn</h3><p>The original Heyzine reader keeps page flips, zoom, sharing and fullscreen intact.</p></article>
    </section>

    {activeIssue && <div className="magazine-reader-overlay" role="dialog" aria-modal="true" aria-label={activeIssue.title}>
      <header><div><img src="/domino-pulse-logo.png" alt="" /><span>{activeIssue.title}</span></div><button type="button" onClick={() => setActiveIssue(null)} aria-label="Close magazine">×</button></header>
      <iframe title={activeIssue.title} src={activeIssue.url} allow="fullscreen; clipboard-write" allowFullScreen />
    </div>}
  </main>;
}
