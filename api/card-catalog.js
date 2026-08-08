const SHEET_URL = "https://docs.google.com/spreadsheets/d/1dso-ihpm_0xl50_rLtb13vfGJZc3A4L-a0JBMH1XPyw/gviz/tq?gid=1009745992&headers=1";
const CACHE_MS = 10 * 60 * 1000;
let cachedCatalog = null;
let cachedAt = 0;
const artworkCache = new Map();

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function similarity(left, right) {
  const a = normalise(left);
  const b = normalise(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function matchScore(cardName, searchValue) {
  const name = normalise(cardName);
  const query = normalise(searchValue);
  if (name === query) return 1;
  if (name.startsWith(query)) return .97;
  if (name.includes(query)) return .9;
  const nameTokens = name.split(" ");
  const queryTokens = query.split(" ");
  const tokens = queryTokens.reduce((sum, queryToken) => sum + nameTokens.reduce((best, nameToken) => {
    if (nameToken === queryToken) return 1;
    if (nameToken.startsWith(queryToken) || queryToken.startsWith(nameToken)) return Math.max(best, .92);
    return Math.max(best, similarity(nameToken, queryToken));
  }, 0), 0) / queryTokens.length;
  return Math.max(similarity(name, query), tokens * .94);
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

async function fetchArtwork(url) {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    return (await response.json()).data ?? [];
  } catch {
    return [];
  }
}

function rememberArtwork(cards) {
  for (const card of cards) {
    const image = card.card_images?.[0];
    artworkCache.set(normalise(card.name), {
      ygo_card_id: card.id ?? null,
      image_url: image?.image_url ?? null,
      image_url_small: image?.image_url_small ?? image?.image_url ?? null,
      description: card.desc ?? "",
    });
  }
}

async function addArtwork(cards, query) {
  const missing = cards.filter((card) => !artworkCache.has(normalise(card.name)));

  if (missing.length) {
    rememberArtwork(await fetchArtwork("https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=" + encodeURIComponent(query)));
    const unresolved = missing.filter((card) => !artworkCache.has(normalise(card.name)));
    const exactResults = await Promise.all(unresolved.map((card) => fetchArtwork("https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + encodeURIComponent(card.name))));
    exactResults.forEach(rememberArtwork);

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

  const query = String(req.query?.q ?? "").trim().slice(0, 120);
  if (query.length < 2) return res.status(200).json({ cards: [] });

  try {
    const cards = await getCatalog();
    const minimumScore = normalise(query).length <= 3 ? .62 : .48;
    const candidates = cards
      .map((card) => ({ ...card, matchScore: matchScore(card.name, query) }))
      .filter((card) => card.matchScore >= minimumScore)
      .sort((left, right) => right.matchScore - left.matchScore || left.name.localeCompare(right.name))
      .slice(0, 8);
    const matches = (await addArtwork(candidates, query)).map((card) => ({
      name: card.name,
      category: card.category,
      rarity: card.rarity,
      gameRarity: card.gameRarity,
      ygo_card_id: card.ygo_card_id ?? null,
      image_url: card.image_url ?? null,
      image_url_small: card.image_url_small ?? card.image_url ?? null,
      description: card.description ?? "",
    }));
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ cards: matches, source: "DMO · All Cards" });
  } catch (error) {
    return res.status(502).json({ error: error.message ?? "The official card catalogue could not be loaded." });
  }
}
