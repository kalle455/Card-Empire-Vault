import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./VaultLoader.css";

const emptySlots = Array.from({ length: 5 }, (_, index) => ({ id: "slot-" + index }));

export default function VaultLoader() {
  const sectionRef = useRef(null);
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setOpened(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setOpened(true);
        observer.disconnect();
      }
    }, { threshold: 0.28 });

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadVaultTreasures() {
      const { data } = await supabase
        .from("cards")
        .select("id, name, image_url, price, rarity")
        .gt("quantity", 0)
        .order("price", { ascending: false })
        .limit(5);

      if (active) setCards(data ?? []);
    }

    loadVaultTreasures();
    const channel = supabase
      .channel("homepage-vault-loader")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, loadVaultTreasures)
      .subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, []);

  function tiltCard(event) {
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty("--treasure-tilt-x", (-y * 9).toFixed(2) + "deg");
    card.style.setProperty("--treasure-tilt-y", (x * 9).toFixed(2) + "deg");
  }

  function resetCardTilt(event) {
    event.currentTarget.style.removeProperty("--treasure-tilt-x");
    event.currentTarget.style.removeProperty("--treasure-tilt-y");
  }

  function launchMarket() {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(() => navigate("/marketplace"), 620);
  }

  const treasures = cards.length ? cards : emptySlots;

  return (
    <section className={"vault-loader-section " + (opened ? "is-open " : "") + (launching ? "is-launching" : "")} ref={sectionRef}>
      <div className="vault-loader-aura" aria-hidden="true" />
      <div className="vault-loader-transition" aria-hidden="true"><span>K</span></div>
      <div className="vault-loader-layout">
        <div className="vault-loader-stage" aria-label="Kalenski Vault Loader opening">
          <div className="vault-loader-box">
            <div className="vault-loader-lid" aria-hidden="true">
              <span className="vault-loader-lid-inner"><b>KALENSKI™</b><small>DECK VAULT · SERIES 01</small></span>
            </div>
            <div className="vault-loader-base">
              <div className="vault-loader-rim" aria-hidden="true" />
              <div className="vault-loader-front-mark" aria-hidden="true"><span>K</span><small>VAULT<br />LOADER</small></div>
              <div className="vault-loader-slots">
                {treasures.map((card, index) => (
                  <button className={"vault-loader-card " + (card.rarity ?? "slot")} style={{ "--vault-card-index": index }} type="button" key={card.id} onPointerMove={tiltCard} onPointerLeave={resetCardTilt} onClick={launchMarket} aria-label={card.name ? "Enter Card Market with " + card.name : "Enter Card Market"}>
                    <span className="vault-loader-card-case">
                      {card.image_url ? <img src={card.image_url} alt={card.name} loading="lazy" /> : <span className="vault-loader-card-placeholder">✦</span>}
                    </span>
                    <span className="vault-loader-card-meta">
                      <b>{card.name ?? "Vault treasure"}</b>
                      <small>{card.price ? Number(card.price).toLocaleString() + " G" : "UNLOCKING"}</small>
                    </span>
                  </button>
                ))}
              </div>
              <span className="vault-loader-seal" aria-hidden="true">K</span>
            </div>
          </div>
          <p className="vault-loader-stage-caption"><span />Move a card in 3D · Select it to enter the Market</p>
        </div>
        <div className="vault-loader-copy">
          <p className="vault-loader-kicker">THE VAULT IS OPEN</p>
          <h2>Five treasures.<br /><em>One Empire.</em></h2>
          <p>Each card rises from Kalenski™’s private Deck Vault. Move a treasure in 3D — then select it to enter the Card Market.</p>
          <button type="button" className="vault-loader-cta" onClick={launchMarket}><span>Enter Card Market</span><b>↗</b></button>
          <p className="vault-loader-note"><i /> Live selection · Prices update automatically</p>
        </div>
      </div>
    </section>
  );
}
