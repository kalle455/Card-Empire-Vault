import { useState } from "react";
import "./IndependenceNotice.css";

const storageKey = "card-empire-independent-notice-v1";

export default function IndependenceNotice() {
  const [open, setOpen] = useState(() => window.localStorage?.getItem(storageKey) !== "accepted");

  function accept() {
    window.localStorage?.setItem(storageKey, "accepted");
    setOpen(false);
  }

  if (!open) return null;

  return <div className="independence-notice-backdrop" role="presentation">
    <section className="independence-notice" role="dialog" aria-modal="true" aria-labelledby="independence-title" aria-describedby="independence-copy">
      <span className="independence-notice-mark" aria-hidden="true">KE</span>
      <p>INDEPENDENT PROJECT NOTICE</p>
      <h1 id="independence-title">Before you enter<br /><em>Card Empire.</em></h1>
      <div id="independence-copy">
        <strong>Card Empire is an independent project created and operated by Kalenski.</strong>
        <p>It is not operated, sponsored, approved or supported by Duel Monsters Online (DMO). DMO is not involved in Card Empire purchases, trades, events, data or support.</p>
      </div>
      <button type="button" onClick={accept}><span>I understand · Enter Card Empire</span><b>→</b></button>
      <small>This notice is saved on this device after confirmation.</small>
    </section>
  </div>;
}
