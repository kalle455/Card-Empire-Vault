import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DMO_CATALOG_URL = "https://docs.google.com/spreadsheets/d/1dso-ihpm_0xl50_rLtb13vfGJZc3A4L-a0JBMH1XPyw/gviz/tq?gid=1009745992&headers=1";

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dmoRarity(value) {
  const rarity = normalise(value);
  if (rarity === "rainbow") return "rainbow";
  if (rarity === "gold") return "gold";
  if (rarity === "silver") return "rare";
  return "common";
}

function dmoCategory(value) {
  const type = normalise(value);
  if (type.includes("spell")) return "spell";
  if (type.includes("trap")) return "trap";
  return "monster";
}

function officialDmoCatalog() {
  const moduleId = "virtual:dmo-card-catalog";
  const resolvedId = "\0" + moduleId;
  let cachedModule = null;

  return {
    name: "official-dmo-card-catalog",
    resolveId(id) {
      return id === moduleId ? resolvedId : null;
    },
    async load(id) {
      if (id !== resolvedId) return null;
      if (cachedModule) return cachedModule;

      try {
        const response = await fetch(DMO_CATALOG_URL);
        const raw = await response.text();
        const match = raw.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
        if (!response.ok || !match) throw new Error("catalogue unavailable");

        const table = JSON.parse(match[1]).table;
        const columns = (table.cols ?? []).map((column) => column.label || column.id || "");
        const nameIndex = columns.findIndex((column) => normalise(column) === "name");
        const typeIndex = columns.findIndex((column) => normalise(column) === "card type");
        const rarityIndex = columns.findIndex((column) => normalise(column) === "rarity");

        if (nameIndex < 0 || rarityIndex < 0) throw new Error("catalogue columns unavailable");

        const cards = (table.rows ?? [])
          .map((row) => row.c ?? [])
          .map((cells) => {
            const name = String(cells[nameIndex]?.v ?? "").trim();
            const gameRarity = String(cells[rarityIndex]?.v ?? "").trim();
            if (!name || !gameRarity) return null;
            return {
              name,
              category: dmoCategory(cells[typeIndex]?.v),
              rarity: dmoRarity(gameRarity),
              gameRarity,
            };
          })
          .filter(Boolean);

        cachedModule = "export default " + JSON.stringify(cards) + ";";
      } catch {
        cachedModule = "export default [];";
      }

      return cachedModule;
    },
  };
}

// Codespaces forwards the local Vite server through a public app.github.dev address.
export default defineConfig({
  plugins: [react(), officialDmoCatalog()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
