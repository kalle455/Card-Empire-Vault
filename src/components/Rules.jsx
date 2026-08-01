import { Link } from "react-router-dom";
import "./Rules.css";

const rules = [
  ["01", "No refunds.", "Every purchase request is binding once the deal is completed."],
  ["02", "No exchanges.", "Cards cannot be exchanged after a completed handover."],
  ["03", "All sales are final.", "Check the card, condition and agreed price before the DEAL is sealed."],
  ["04", "Respect the Empire.", "Fraud, harassment and manipulation end access to Card Empire immediately."],
];

export default function Rules() {
  return <main className="rules-page">
    <section className="rules-hero">
      <div className="rules-scan" aria-hidden="true" />
      <p className="vault-overline">RIGHTS &amp; POLICIES · FILE K-04</p>
      <h1>The rules<br /><em>of the Empire.</em></h1>
      <p>Clear terms protect every player, every card and every completed deal.</p>
    </section>

    <section className="rules-ledger">
      {rules.map(([number, title, body]) => <article key={number}>
        <span>{number}</span><div><h2>{title}</h2><p>{body}</p></div>
      </article>)}
    </section>

    <section className="rules-data-clause">
      <p className="vault-overline">DUEL DISC DATA DIRECTIVE</p>
      <h2>Kaiba Corporation<br /><em>data protocol.</em></h2>
      <p>All Duel Disc data belongs to the Kaiba Corporation. The Kaiba Corporation is a subsidiary of Kalenski™ Holdings.</p>
      <small>Fictional fan-universe policy. Yu-Gi-Oh! and related names remain the property of their respective owners.</small>
    </section>

    <section className="rules-closing">
      <p>Entering the Card Market confirms that you understand these rules.</p>
      <Link to="/marketplace">Return to Card Market <b>↗</b></Link>
    </section>
  </main>;
}
