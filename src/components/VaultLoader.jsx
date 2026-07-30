import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./VaultLoader.css";

const emptySlots = Array.from({ length: 5 }, (_, index) => ({ id: "slot-" + index }));

export default function VaultLoader() {
  const sectionRef = useRef(null);
  const [opened, setOpened] = useState(false);
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
    return () => { active = false; };
  }, []);

  const treasures = cards.length ? cards : emptySlots;

  return (
    <section className={"vault-loader-section " + (opened ? "is-open" : "")} ref={sectionRef}>
      <div className="vault-loader-aura" aria-hidden="true" />
      <div className="vault-loader-layout">
        <div className="vault-loader-stage" aria-label="Kalenski Vault Loader opening">
          <div className="vault-loader-box">
            <div className="vault-loader-lid" aria-hidden="true">
              <span className="vault-loader-lid-inner"><b>KALENSKI™</b><small>VAULT LOADER · SERIES 01</small></span>
            </div>
            <div className="vault-loader-base">
              <div className="vault-loader-rim" aria-hidden="true" />
              <div className="vault-loader-slots">
                {treasures.map((card, index) => (
                  <Link className={"vault-loader-card " + (card.rarity ?? "slot")} style={{ "--vault-card-index": index }} to="/marketplace" key={card.id}>
                    <span className="vault-loader-card-case">
                      {card.image_url ? <img src={card.image_url} alt={card.name} loading="lazy" /> : <span className="vault-loader-card-placeholder">✦</span>}
                    </span>
                    <span className="vault-loader-card-meta">
                      <b>{card.name ?? "Vault treasure"}</b>
                      <small>{card.price ? Number(card.price).toLocaleString() + " G" : "UNLOCKING"}</small>
                    </span>
                  </Link>
                ))}
              </div>
              <span className="vault-loader-seal" aria-hidden="true">K</span>
            </div>
          </div>
          <p className="vault-loader-stage-caption"><span />Five highest-value cards currently in the vault</p>
        </div>
        <div className="vault-loader-copy">
          <p className="vault-loader-kicker">THE VAULT IS OPEN</p>
          <h2>Five treasures.<br /><em>One Empire.</em></h2>
          <p>Every card is selected, protected and ready to enter the next collection. Step inside the private Kalenski™ Card Market.</p>
          <Link className="vault-loader-cta" to="/marketplace"><span>Enter Card Market</span><b>↗</b></Link>
          <p className="vault-loader-note"><i /> Live selection · Prices update automatically</p>
        </div>
      </div>
    </section>
  );
}
