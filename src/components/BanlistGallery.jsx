import { useEffect, useMemo, useState } from "react";
import "./BanlistGallery.css";

const artworkCache = new Map();

function cardNames(value) {
  if (Array.isArray(value)) return value.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim());
  if (typeof value === "string") return value.split(/(?:\r?\n|,)/).map((name) => name.trim()).filter(Boolean);
  return [];
}

function getGroups(banlist) {
  const banned = cardNames(banlist?.banned_cards);
  const limited = cardNames(banlist?.limited_cards);
  const legacyCards = !banned.length && !limited.length ? cardNames(banlist?.card_names) : [];

  return [
    { key: "banned", title: "Banned", note: "Not allowed", cards: banned.length ? banned : legacyCards },
    { key: "limited", title: "Limited", note: "One copy allowed", cards: limited },
  ].filter((group) => group.cards.length);
}

async function findArtwork(name) {
  if (artworkCache.has(name)) return artworkCache.get(name);

  try {
    const response = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + encodeURIComponent(name));
    const body = response.ok ? await response.json() : null;
    const image = body?.data?.[0]?.card_images?.[0]?.image_url_small ?? null;
    artworkCache.set(name, image);
    return image;
  } catch {
    artworkCache.set(name, null);
    return null;
  }
}

export default function BanlistGallery({ banlist }) {
  const [mode, setMode] = useState("visual");
  const safeBanlist = useMemo(() => Array.isArray(banlist) ? (banlist[0] ?? {}) : (banlist ?? {}), [banlist]);
  const groups = useMemo(() => getGroups(safeBanlist), [safeBanlist]);
  const names = useMemo(() => [...new Set(groups.flatMap((group) => group.cards))], [groups]);
  const namesKey = names.join("|");
  const [artwork, setArtwork] = useState({});

  useEffect(() => {
    let active = true;
    const known = Object.fromEntries(names.filter((name) => artworkCache.has(name)).map((name) => [name, artworkCache.get(name)]));
    setArtwork(known);

    const missing = names.filter((name) => !artworkCache.has(name));
    let next = 0;

    async function worker() {
      while (next < missing.length) {
        const name = missing[next++];
        const image = await findArtwork(name);
        if (active) setArtwork((current) => ({ ...current, [name]: image }));
      }
    }

    Promise.all(Array.from({ length: Math.min(3, missing.length) }, worker));
    return () => { active = false; };
  }, [namesKey]);

  return (
    <section className="banlist-gallery">
      <header className="banlist-gallery-header">
        <div><p className="eyebrow">OFFICIAL FORMAT</p><strong>{safeBanlist.name ?? "Tournament banlist"}</strong></div>
        <div className="banlist-view-switch" aria-label="Banlist view">
          <button type="button" className={mode === "visual" ? "active" : ""} onClick={() => setMode("visual")}>Cards</button>
          <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>List</button>
        </div>
      </header>
      <div className={"banlist-groups " + (mode === "list" ? "is-list" : "")}>
        {groups.map((group) => (
          <section className={"banlist-group " + group.key} key={group.key}>
            <header><div><span>{group.title}</span><small>{group.note}</small></div><b>{group.cards.length}</b></header>
            <div className="banlist-entries">
              {group.cards.map((name, index) => (
                <article className="banlist-entry" key={group.key + name}>
                  {mode === "visual" && (artwork[name]
                    ? <img src={artwork[name]} alt={name} loading="lazy" />
                    : <span className="banlist-card-placeholder" aria-hidden="true">✦</span>)}
                  <span className="banlist-entry-name"><small>{String(index + 1).padStart(2, "0")}</small><b>{name}</b></span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
