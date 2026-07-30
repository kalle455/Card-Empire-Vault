const SHEET_URL = "https://docs.google.com/spreadsheets/d/1dso-ihpm_0xl50_rLtb13vfGJZc3A4L-a0JBMH1XPyw/gviz/tq?gid=1009745992&headers=1";
const CACHE_MS = 10 * 60 * 1000;
let cachedCatalog = null;
let cachedAt = 0;

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toRarity(value) {
  const rarity = normalise(value);
  if (rarity === "rainbow") return "rainbow";
  if (rarity === "gold") return "gold";
  if (rarity === "silver") return "rare";
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

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ cards: [...unique.values()], source: "DMO · All Cards" });
  } catch (error) {
    return res.status(502).json({ error: error.message ?? "The official card catalogue could not be loaded." });
  }
}
