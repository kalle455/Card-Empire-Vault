const SHEET_URL = "https://docs.google.com/spreadsheets/d/1dso-ihpm_0xl50_rLtb13vfGJZc3A4L-a0JBMH1XPyw/gviz/tq?gid=1009745992&headers=1";
const CACHE_MS = 10 * 60 * 1000;
let cachedCatalog = null;
let cachedAt = 0;
const artworkCache = new Map();

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toRarity(value) {
  const rarity = normalise(value);
  if (rarity === "rainbow") return "rainbow";
  if (rarity === "gold") return "gold";
  if (rarity === "silver" || rarity === "rare") return "silver";
  return "common";
}

function toCategory(value) {
  const category = normalise(value);
  if (category.includes("spell")) return "spell";
  if (category.includes("trap")) return "trap";
  return "monster";
}

function columnIndex(columns, predicates) {
  return columns.findIndex((column) => predicates.some((predicate) => predicate(normalise(column))));
}

function parseGoogleTable(payload) {
  const match = String(payload).match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!match) throw new Error("The official card catalogue returned an unexpected format.");

  const table = JSON.parse(match[1]).table;
  const headers = (table.cols ?? []).map((column) => column.label || column.id || "");
  const nameIndex = columnIndex(headers, [(value) => value === "name", (value) => value.includes("card name")]);
  const typeIndex = columnIndex(headers, [(value) => value === "card type", (value) => value === "type"]);
  const rarityIndex = columnIndex(headers, [(value) => value === "rarity"]);

  if (nameIndex < 0 || rarityIndex < 0) throw new Error("The official catalogue needs Name and Rarity columns.");

  return (table.rows ?? [])
    .map((row) => row.c ?? [])
    .map((cells) => {
      const name = String(cells[nameIndex]?.v ?? "").trim();
      const gameRarity = String(cells[rarityIndex]?.v ?? "").trim();
      if (!name || !gameRarity) return null;
      return {
        name,
        category: toCategory(cells[typeIndex]?.v),
        rarity: toRarity(gameRarity),
        gameRarity,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function getCatalog() {
  if (cachedCatalog && Date.now() - cachedAt < CACHE_MS) return cachedCatalog;

  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error("The official card catalogue is temporarily unavailable.");

  cachedCatalog = parseGoogleTable(await response.text());
  cachedAt = Date.now();
  return cachedCatalog;
}

async function addArtwork(cards) {
  const missing = cards.filter((card) => !artworkCache.has(normalise(card.name)));

  if (missing.length) {
    const names = missing.map((card) => card.name).join("|");
    const response = await fetch(
      "https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + encodeURIComponent(names),
      { headers: { Accept: "application/json" } },
    );

    if (response.ok) {
      const payload = await response.json();
      for (const card of payload.data ?? []) {
        const image = card.card_images?.[0];
        artworkCache.set(normalise(card.name), {
          ygo_card_id: card.id ?? null,
          image_url: image?.image_url ?? null,
          image_url_small: image?.image_url_small ?? image?.image_url ?? null,
          description: card.desc ?? "",
        });
      }
    }

    for (const card of missing) {
      const key = normalise(card.name);
      if (!artworkCache.has(key)) artworkCache.set(key, null);
    }
  }

  return cards.map((card) => ({ ...card, ...(artworkCache.get(normalise(card.name)) ?? {}) }));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Only GET requests are supported." });
  }

  const query = String(req.query?.q ?? "").trim();
  if (query.length < 2) return res.status(200).json({ cards: [] });

  try {
    const queryKey = normalise(query);
    const cards = await getCatalog();
    const exact = cards.filter((card) => normalise(card.name) === queryKey);
    const startsWith = cards.filter((card) => normalise(card.name).startsWith(queryKey));
    const includes = cards.filter((card) => normalise(card.name).includes(queryKey));
    const unique = new Map();

    for (const card of [...exact, ...startsWith, ...includes]) {
      if (!unique.has(card.name)) unique.set(card.name, card);
      if (unique.size === 8) break;
    }

    const matches = await addArtwork([...unique.values()]);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ cards: matches, source: "DMO · All Cards" });
  } catch (error) {
    return res.status(502).json({ error: error.message ?? "The official card catalogue could not be loaded." });
  }
}
