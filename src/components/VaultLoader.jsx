import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./VaultLoader.css";

const emptySlots = Array.from({ length: 5 }, (_, index) => ({ id: "slot-" + index }));

export default function VaultLoader() {
  const sectionRef = useRef(null);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [opened, setOpened] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setReady(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });

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

  function tiltBox(event) {
    const box = event.currentTarget;
    const bounds = box.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    box.style.setProperty("--box-tilt-x", (-y * 5).toFixed(2) + "deg");
    box.style.setProperty("--box-tilt-y", (x * 5).toFixed(2) + "deg");
  }

  function resetBoxTilt(event) {
    event.currentTarget.style.removeProperty("--box-tilt-x");
    event.currentTarget.style.removeProperty("--box-tilt-y");
  }

  function openVault() {
    if (opened || transitioning) return;
    setOpened(true);
    window.setTimeout(() => setTransitioning(true), 690);
    window.setTimeout(() => navigate("/marketplace"), 1260);
  }

  const treasures = cards.length ? cards : emptySlots;

  return (
    <section className={"vault-loader-section " + (ready ? "is-ready " : "") + (opened ? "is-open " : "") + (transitioning ? "is-launching" : "")} ref={sectionRef}>
      <div className="vault-loader-aura" aria-hidden="true" />
      <div className="vault-loader-transition" aria-hidden="true"><span>K</span></div>
      <div className="vault-loader-layout">
        <div className="vault-loader-stage">
          <button className="vault-loader-box-trigger" type="button" onClick={openVault} onPointerMove={tiltBox} onPointerLeave={resetBoxTilt} aria-label="Open Kalenski Vault Loader and enter Card Market">
            <span className="vault-loader-box">
              <span className="vault-loader-lid" aria-hidden="true">
                <span className="vault-loader-lid-inner"><b>KALENSKI™</b><small>DECK VAULT · SERIES 01</small></span>
              </span>
              <span className="vault-loader-base">
                <span className="vault-loader-rim" aria-hidden="true" />
                <span className="vault-loader-front-mark" aria-hidden="true"><span>K</span><small>VAULT<br />LOADER</small></span>
                <span className="vault-loader-slots">
                  {treasures.map((card, index) => (
                    <span className={"vault-loader-card " + (card.rarity ?? "slot")} style={{ "--vault-card-index": index }} key={card.id}>
                      <span className="vault-loader-card-case">
                        {card.image_url ? <img src={card.image_url} alt="" loading="lazy" /> : <span className="vault-loader-card-placeholder">✦</span>}
                      </span>
                      <span className="vault-loader-card-meta">
                        <b>{card.name ?? "Vault treasure"}</b>
                        <small>{card.price ? Number(card.price).toLocaleString() + " G" : "UNLOCKING"}</small>
                      </span>
                    </span>
                  ))}
                </span>
                <span className="vault-loader-seal" aria-hidden="true">K</span>
              </span>
            </span>
          </button>
          <p className="vault-loader-stage-caption"><span />Click the Deck Vault to open the Card Market</p>
        </div>
        <div className="vault-loader-copy">
          <p className="vault-loader-kicker">ENTER THE COLLECTION</p>
          <h2>Open the<br /><em>Deck Vault.</em></h2>
          <p>Kalenski™’s private card loader holds the Empire’s most valuable active cards. Open it to enter the Card Market.</p>
          <button type="button" className="vault-loader-cta" onClick={openVault}><span>Open Card Market</span><b>↗</b></button>
          <p className="vault-loader-note"><i /> Five top cards · Live selection</p>
        </div>
      </div>
    </section>
  );
}
