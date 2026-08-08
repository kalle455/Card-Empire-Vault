import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import officialDmoCatalog from "virtual:dmo-card-catalog";
import "./AdminDashboard.css";
import "./AdminAvailability.css";
import "./AdminSidebar.css";

const blankCard = { name: "", price: "", quantity: "1", category: "monster", rarity: "silver" };
const blankEvent = { title: "", starts_at: "", description: "", event_format: "five_way_ffa" };
const blankAvailability = { title: "Card pickup", location: "DMO", starts_at: "", ends_at: "", note: "" };
const roles = ["customer", "regular_customer", "vip", "potm", "admin"];
const roleLabels = { customer: "Customer", regular_customer: "Regular Customer", vip: "V.I.P", potm: "POTM Â· Player of the Tournament", admin: "Kalenski Â· Admin" };
const eventFormats = [
  { value: "five_way_ffa", label: "5-WAY FFA", detail: "5 players", capacity: 5 },
  { value: "six_way_ffa", label: "6-WAY FFA", detail: "6 players", capacity: 6 },
  { value: "three_way_ffa", label: "3-WAY FFA", detail: "2v2v2 Â· 6 players", capacity: 6 },
  { value: "four_way_ffa", label: "4-WAY FFA", detail: "2v2v2v2 Â· 8 players", capacity: 8 },
];
const getEventFormat = (value) => eventFormats.find((format) => format.value === value) ?? { label: "OPEN FORMAT", detail: "No player limit", capacity: null };

const toLocalDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
const normaliseCardName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function textSimilarity(left, right) {
  const a = normaliseCardName(left);
  const b = normaliseCardName(right);
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

function detectCatalogCards(ocrText) {
  const normalisedText = normaliseCardName(ocrText);
  const lines = String(ocrText ?? "").split(/\r?\n/).map(normaliseCardName).filter((line) => line.length > 2);
  return officialDmoCatalog
    .map((catalogCard) => {
      const name = normaliseCardName(catalogCard.name);
      const exact = normalisedText.includes(name);
      const bestLine = lines.reduce((best, line) => Math.max(best, textSimilarity(name, line)), 0);
      const nameTokens = name.split(" ").filter((token) => token.length > 2);
      const tokenScore = nameTokens.length ? nameTokens.filter((token) => normalisedText.includes(token)).length / nameTokens.length : 0;
      const score = exact ? .99 : Math.max(bestLine, tokenScore * .86);
      return { ...catalogCard, confidence: Math.round(score * 100) };
    })
    .filter((catalogCard) => catalogCard.confidence >= 58)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
    .slice(0, 24);
}

const adminIconPaths = {
  cards: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",
  books: "M4 5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-6a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h6z",
  offers: "M4 7h16v12H4zM8 7V5h8v2M8 12h8M8 15h5",
  trades: "M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3",
  events: "M5 5h14v15H5zM8 3v4M16 3v4M5 9h14M9 13h2M13 13h2M9 16h2",
  community: "M5 6h14v10H9l-4 4zM9 10h6M9 13h4",
  players: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5M3 20a5 5 0 0 1 10 0M14 20a4 4 0 0 1 7 0",
  pricing: "M12 3v18M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5 9.8 10.1 12 10.1s4 1.1 4 3.4-1.8 4-4 4-4-1.1-4-3.2",
};

function AdminIcon({ name }) {
  return <span className="admin-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={adminIconPaths[name]} /></svg></span>;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("cards");
  const [data, setData] = useState({ cards: [], events: [], offers: [], trades: [], players: [], purchases: [], availability: [], presence: null, communitySuggestions: [], communityReviews: [], feedback: [], automaticDiscounts: [], discountCodes: [], bundleOffers: [] });
  const [card, setCard] = useState(blankCard);
  const [event, setEvent] = useState(blankEvent);
  const [editingEventId, setEditingEventId] = useState(null);
  const [notice, setNotice] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCatalogCard, setSelectedCatalogCard] = useState(null);
  const [winnerSelections, setWinnerSelections] = useState({});
  const [editingCard, setEditingCard] = useState(null);
  const [adminAnnouncement, setAdminAnnouncement] = useState({ title: "", body: "" });
  const [adminPoll, setAdminPoll] = useState({ question: "", options: "" });
  const [availabilityForm, setAvailabilityForm] = useState(blankAvailability);
  const [presenceNote, setPresenceNote] = useState("Kalenski is online now.");
  const [discountForm, setDiscountForm] = useState({ name: "", percentage: "", starts_at: "", ends_at: "", min_total: "0", min_card_count: "0" });
  const [codeForm, setCodeForm] = useState({ code: "", percentage: "", starts_at: "", ends_at: "", min_total: "0", min_card_count: "0", max_uses: "" });
  const [bundleCounters, setBundleCounters] = useState({});
  const [marketPriceFilter, setMarketPriceFilter] = useState("all");
  const [inventoryScan, setInventoryScan] = useState({ state: "idle", progress: 0, preview: "", filename: "" });
  const [scanCandidates, setScanCandidates] = useState([]);
  const [scanManualQuery, setScanManualQuery] = useState("");

  async function load() {
    const [cards, events, offers, trades, players, purchases, availability, presence, communitySuggestions, communityReviews, feedback, automaticDiscounts, discountCodes, bundleOffers] = await Promise.all([
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*, registrations:event_registrations(player_id, player:profiles(id, username))").order("starts_at"),
      supabase.from("offers").select("*, player:profiles(username)").order("created_at", { ascending: false }),
      supabase.from("trade_offers").select("*, player:profiles(username), card:cards(name)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("username"),
      supabase.from("purchases").select("*, player:profiles(username), card:cards(name)").order("created_at", { ascending: false }),
      supabase.from("empire_availability").select("*").order("starts_at", { ascending: true }),
      supabase.from("empire_presence").select("*").eq("singleton", true).maybeSingle(),
      supabase.from("community_suggestions").select("*").order("created_at", { ascending: false }),
      supabase.from("community_reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("automatic_discounts").select("*").order("created_at", { ascending: false }),
      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("bundle_offers").select("*, buyer:profiles(username,dmo_name)").order("created_at", { ascending: false }),
    ]);
    setData({
      cards: cards.data ?? [],
      events: events.data ?? [],
      offers: offers.data ?? [],
      trades: trades.data ?? [],
      players: players.data ?? [],
      purchases: purchases.data ?? [],
      availability: availability.data ?? [],
      presence: presence.data ?? null,
      communitySuggestions: communitySuggestions.data ?? [],
      communityReviews: communityReviews.data ?? [],
      feedback: feedback.data ?? [],
      automaticDiscounts: automaticDiscounts.data ?? [],
      discountCodes: discountCodes.data ?? [],
      bundleOffers: bundleOffers.data ?? [],
    });
    if (presence.data?.status_note) setPresenceNote(presence.data.status_note);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => {
    if (inventoryScan.preview) URL.revokeObjectURL(inventoryScan.preview);
  }, [inventoryScan.preview]);
  useEffect(() => {
    const term = card.name.trim();
    if (selectedCatalogCard?.name === term || term.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const query = normaliseCardName(term);
    const exact = officialDmoCatalog.filter((item) => normaliseCardName(item.name) === query);
    const startsWith = officialDmoCatalog.filter((item) => normaliseCardName(item.name).startsWith(query));
    const includes = officialDmoCatalog.filter((item) => normaliseCardName(item.name).includes(query));
    const matches = new Map();

    for (const item of [...exact, ...startsWith, ...includes]) {
      if (!matches.has(item.name)) matches.set(item.name, item);
      if (matches.size === 8) break;
    }

    const localMatches = [...matches.values()];
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestions(localMatches);
      setCatalogLoading(true);
      try {
        const response = await fetch("/api/card-catalog?q=" + encodeURIComponent(term), { signal: controller.signal });
        const payload = response.ok ? await response.json() : null;
        if (payload?.cards?.length) setSuggestions(payload.cards);
      } catch (error) {
        if (error.name !== "AbortError") setSuggestions(localMatches);
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [card.name, selectedCatalogCard]);

  if (profile?.role !== "admin") {
    return <section className="admin-shell"><p className="vault-overline">RESTRICTED AREA</p><h1>Admin access only.</h1><p>Sign in with Kalenskiâ€™s administrator account to manage the Empire.</p></section>;
  }

  const totalGold = data.purchases.reduce((sum, item) => sum + Number(item.paid_gold), 0);
  const cardsSold = data.purchases.reduce((sum, item) => sum + Number(item.quantity), 0);

  async function addCard(e) {
    e.preventDefault();
    if (!selectedCatalogCard) {
      return setNotice("Choose a card from the official DMO catalogue first.");
    }

    setNotice("Getting the automatic card imageâ€¦");
    let selected = selectedCatalogCard;
    if (!selected.image_url) {
      const lookup = await fetch("/api/card-catalog?q=" + encodeURIComponent(selectedCatalogCard.name))
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null);
      selected = lookup?.cards?.find((item) => normaliseCardName(item.name) === normaliseCardName(selectedCatalogCard.name)) ?? selectedCatalogCard;
    }

    const { error } = await supabase.from("cards").insert({
      name: selectedCatalogCard.name,
      price: Number(card.price),
      quantity: Number(card.quantity),
      category: selectedCatalogCard.category,
      rarity: selectedCatalogCard.rarity,
      ygo_card_id: selected.ygo_card_id ?? null,
      image_url: selected.image_url ?? null,
      description: selected.description ?? "",
    });

    if (error) return setNotice(error.message);
    setNotice(selectedCatalogCard.name + " was added to Cardstock Â· " + selectedCatalogCard.gameRarity + " rarity.");
    setCard(blankCard);
    setSelectedCatalogCard(null);
    load();
  }

  async function enrichCatalogCard(catalogCard) {
    try {
      const response = await fetch("/api/card-catalog?q=" + encodeURIComponent(catalogCard.name));
      const payload = response.ok ? await response.json() : null;
      return payload?.cards?.find((item) => normaliseCardName(item.name) === normaliseCardName(catalogCard.name)) ?? catalogCard;
    } catch {
      return catalogCard;
    }
  }

  async function scanInventoryScreenshot(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setNotice("Choose a PNG, JPG or WEBP screenshot.");
    if (file.size > 12 * 1024 * 1024) return setNotice("The screenshot must be smaller than 12 MB.");

    if (inventoryScan.preview) URL.revokeObjectURL(inventoryScan.preview);
    const preview = URL.createObjectURL(file);
    setInventoryScan({ state: "reading", progress: 0, preview, filename: file.name });
    setScanCandidates([]);
    setNotice("Reading card names from the screenshot locally in your browserâ€¦");

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng", {
        logger: (message) => {
          if (message.status === "recognizing text") setInventoryScan((current) => ({ ...current, progress: Math.round((message.progress ?? 0) * 100) }));
        },
      });
      const detected = detectCatalogCards(result.data.text);
      const enriched = await Promise.all(detected.map(async (candidate) => {
        const match = await enrichCatalogCard(candidate);
        const existing = data.cards.find((item) => normaliseCardName(item.name) === normaliseCardName(match.name));
        return {
          ...candidate,
          ...match,
          selected: candidate.confidence >= 78,
          quantity: 1,
          price: existing?.price ?? "",
          existingId: existing?.id ?? null,
        };
      }));
      setScanCandidates(enriched);
      setInventoryScan((current) => ({ ...current, state: "review", progress: 100 }));
      setNotice(enriched.length ? `${enriched.length} possible card matches found. Review every row before importing.` : "No safe catalogue match was found. Add cards manually in the review area.");
    } catch (error) {
      setInventoryScan((current) => ({ ...current, state: "error" }));
      setNotice("The screenshot could not be read: " + error.message);
    }
  }

  async function addManualScanCandidate(catalogCard) {
    const match = await enrichCatalogCard(catalogCard);
    const existing = data.cards.find((item) => normaliseCardName(item.name) === normaliseCardName(match.name));
    setScanCandidates((current) => current.some((item) => normaliseCardName(item.name) === normaliseCardName(match.name)) ? current : [...current, {
      ...catalogCard,
      ...match,
      confidence: null,
      selected: true,
      quantity: 1,
      price: existing?.price ?? "",
      existingId: existing?.id ?? null,
    }]);
    setScanManualQuery("");
  }

  function updateScanCandidate(index, patch) {
    setScanCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function importScanCandidates() {
    const approved = scanCandióÞô¶‰žËkºwµçM…”€˜˜€ñÍµ…±°ù5•ÍÍ…”èí¥Ñ•´¹µ•ÍÍ…•ôð½Íµ…±°ùôð½ÍÁ…¸øñ•´ùí¥Ñ•´¹ÍÑ…ÑÕÍôð½•´ùí¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰Á•¹‘¥¹œˆ€˜˜€ñ…Í¥‘”øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•ÍÁ½¹‘Q½QÉ…‘”¡¥Ñ•´¹¥°€‰…•ÁÑ•ˆ¥ôù•ÁÐ€¬¡…Ðð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•ÍÁ½¹‘Q½QÉ…‘”¡¥Ñ•´¹¥°€‰¹•½Ñ¥…Ñ¥¹œˆ¥ôù9•½Ñ¥…Ñ”€¬¡…Ðð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•ÍÁ½¹‘Q½QÉ…‘”¡¥Ñ•´¹¥°€‰‘•±¥¹•ˆ¥ôù•±¥¹”ð½‰ÕÑÑ½¸øð½…Í¥‘”ùõí¥Ñ•´¹¡…Ñ}¥€˜˜€ñ…Í¥‘”øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÝ¥¹‘½Ü¹±½…Ñ¥½¸¹…ÍÍ¥¸ ˆ½¡…ÑÌˆ¥ôù=Á•¸¡…Ðð½‰ÕÑÑ½¸øð½…Í¥‘”ùôð½‘¥Øø¥ô(€€€€€€€ì…‘…Ñ„¹ÑÉ…‘•Ì¹±•¹Ñ €˜˜€ñÀù9¼QÉ…‘”!Õˆ½™™•ÉÌå•Ð¸ð½Àùô(€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ùô((€€€€€íÑ…ˆ€ôôô€‰ÁÉ¥¥¹œˆ€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁÉ¥¥¹œµ½¹Í½±”ˆø(€€€€€€€€ñ¡•…‘•È±…ÍÍ9…µ”ô‰…‘µ¥¸µ½É‘•Èµ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÍ9…µ”ô‰Ù…Õ±Ðµ½Ù•É±¥¹”ˆùAI%=9QI=0ð½Àøñ Èù¥Í½Õ¹ÑÌ€˜‰Õ¹‘±”½™™•ÉÌð½ Èøð½‘¥ØøñÍÁ…¸ùM•ÉÙ•ÈÙ•É¥™¥•ð½ÍÁ…¸øð½¡•…‘•Èø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ¥…‘µ¥¸µÁÉ¥¥¹œµ™½ÉµÌˆø(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆ½¹MÕ‰µ¥ÐõíÉ•…Ñ•ÕÑ½µ…Ñ¥¥Í½Õ¹Ñôø(€€€€€€€€€€€€ñ‘µ¥¹%½¸¹…µ”ô‰ÁÉ¥¥¹œˆ€¼øñ ÌùÕÑ½µ…Ñ¥Œ‘¥Í½Õ¹Ðð½ ÌøñÀùÁÁ±¥•Ì…ÕÑ½µ…Ñ¥…±±äÝ¡•¸Ñ¡”…Ñ¥Ù”Ñ¥µ”…¹µ¥¹¥µÕ´½É‘•ÈÉÕ±•Ìµ…Ñ ¸ð½Àø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ¥¹ÁÕÐÉ•ÅÕ¥É•µ…á1•¹Ñ ôˆàÀˆÁ±…•¡½±‘•Èô‰…µÁ…¥¸¹…µ”ˆÙ…±Õ”õí‘¥Í½Õ¹Ñ½É´¹¹…µ•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥Í½Õ¹Ñ½É´¡ì€¸¸¹‘¥Í½Õ¹Ñ½É´°¹…µ”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øñ¥¹ÁÕÐÉ•ÅÕ¥É•ÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀ¸ÀÄˆµ…àôˆäÀˆÍÑ•ÀôˆÀ¸ÀÄˆÁ±…•¡½±‘•Èô‰¥Í½Õ¹Ð€”ˆÙ…±Õ”õí‘¥Í½Õ¹Ñ½É´¹Á•É•¹Ñ…•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥Í½Õ¹Ñ½É´¡ì€¸¸¹‘¥Í½Õ¹Ñ½É´°Á•É•¹Ñ…”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ±…‰•°ùMÑ…ÉÑÌñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆÙ…±Õ”õí‘¥Í½Õ¹Ñ½É´¹ÍÑ…ÉÑÍ}…Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥Í½Õ¹Ñ½É´¡ì€¸¸¹‘¥Í½Õ¹Ñ½É´°ÍÑ…ÉÑÍ}…Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øñ±…‰•°ù¹‘Ìñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆÙ…±Õ”õí‘¥Í½Õ¹Ñ½É´¹•¹‘Í}…Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥Í½Õ¹Ñ½É´¡ì€¸¸¹‘¥Í½Õ¹Ñ½É´°•¹‘Í}…Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÁ±…•¡½±‘•Èô‰5¥¹¥µÕ´Ñ½Ñ…°ˆÙ…±Õ”õí‘¥Í½Õ¹Ñ½É´¹µ¥¹}Ñ½Ñ…±ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥Í½Õ¹Ñ½É´¡ì€¸¸¹‘¥Í½Õ¹Ñ½É´°µ¥¹}Ñ½Ñ…°è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÁ±…•¡½±‘•Èô‰5¥¹¥µÕ´…É½Õ¹ÐˆÙ…±Õ”õí‘¥Í½Õ¹Ñ½É´¹µ¥¹}…É‘}½Õ¹Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥Í½Õ¹Ñ½É´¡ì€¸¸¹‘¥Í½Õ¹Ñ½É´°µ¥¹}…É‘}½Õ¹Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½‘¥Øø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Ù…Õ±ÐµÍÕ‰µ¥ÐˆùAÕ‰±¥Í …ÕÑ½µ…Ñ¥Œ‘¥Í½Õ¹Ðð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½™½É´ø(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆ½¹MÕ‰µ¥ÐõíÉ•…Ñ•¥Í½Õ¹Ñ½‘•ôø(€€€€€€€€€€€€ñ‘µ¥¹%½¸¹…µ”ô‰½™™•ÉÌˆ€¼øñ Ìù¥Í½Õ¹Ð½‘”ð½ ÌøñÀùÉ•…Ñ”„ÁÉ¥Ù…Ñ”¡•­½ÕÐ½‘”Ý¥Ñ ¥ÑÌ½Ý¸±¥µ¥ÑÌ…¹…Ñ¥Ù”Á•É¥½¸ð½Àø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ¥¹ÁÕÐÉ•ÅÕ¥É•µ¥¹1•¹Ñ ôˆÌˆµ…á1•¹Ñ ôˆÌÈˆÁ±…•¡½±‘•Èô‰=ˆÙ…±Õ”õí½‘•½É´¹½‘•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°½‘”è”¹Ñ…É•Ð¹Ù…±Õ”¹Ñ½UÁÁ•É…Í” ¤¹É•Á±…” ½myµhÀ´å|µt½œ°€ˆˆ¤ô¥ô€¼øñ¥¹ÁÕÐÉ•ÅÕ¥É•ÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀ¸ÀÄˆµ…àôˆäÀˆÍÑ•ÀôˆÀ¸ÀÄˆÁ±…•¡½±‘•Èô‰¥Í½Õ¹Ð€”ˆÙ…±Õ”õí½‘•½É´¹Á•É•¹Ñ…•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°Á•É•¹Ñ…”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ±…‰•°ùMÑ…ÉÑÌñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆÙ…±Õ”õí½‘•½É´¹ÍÑ…ÉÑÍ}…Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°ÍÑ…ÉÑÍ}…Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øñ±…‰•°ù¹‘Ìñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆÙ…±Õ”õí½‘•½É´¹•¹‘Í}…Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°•¹‘Í}…Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÁ±…•¡½±‘•Èô‰5¥¹¥µÕ´Ñ½Ñ…°ˆÙ…±Õ”õí½‘•½É´¹µ¥¹}Ñ½Ñ…±ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°µ¥¹}Ñ½Ñ…°è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÁ±…•¡½±‘•Èô‰5¥¹¥µÕ´…É‘ÌˆÙ…±Õ”õí½‘•½É´¹µ¥¹}…É‘}½Õ¹Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°µ¥¹}…É‘}½Õ¹Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÄˆÁ±…•¡½±‘•Èô‰5…àÕÍ•ÌˆÙ…±Õ”õí½‘•½É´¹µ…á}ÕÍ•Íô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½‘•½É´¡ì€¸¸¹½‘•½É´°µ…á}ÕÍ•Ìè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½‘¥Øø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Ù…Õ±ÐµÍÕ‰µ¥ÐˆùÉ•…Ñ”‘¥Í½Õ¹Ð½‘”ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½™½É´ø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ¥…‘µ¥¸µÁÉ¥¥¹œµ±¥ÍÑÌˆø(€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆøñ ÌùÕÑ½µ…Ñ¥Œ…µÁ…¥¹Ìð½ Ìøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µ±¥ÍÐˆø(€€€€€€€€€€€í‘…Ñ„¹…ÕÑ½µ…Ñ¥¥Í½Õ¹ÑÌ¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÁÉ¥¥¹œµÉÕ±”ˆ­•äõí¥Ñ•´¹¥‘ôøñÍÁ…¸øñˆùí¥Ñ•´¹¹…µ•ôƒ
Üí9Õµ‰•È¡¥Ñ•´¹Á•É•¹Ñ…”¥ô”ð½ˆøñÍµ…±°ùí¥Ñ•´¹µ¥¹}…É‘}½Õ¹Ð€ü€‘í¥Ñ•´¹µ¥¹}…É‘}½Õ¹Ñô¬…É‘Í€€è€‰¹ä…É½Õ¹Ð‰ôƒ
Üí9Õµ‰•È¡¥Ñ•´¹µ¥¹}Ñ½Ñ…°¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ôµ¥¹¥µÕ´ð½Íµ…±°øð½ÍÁ…¸øñ•´±…ÍÍ9…µ”õí¥Ñ•´¹…Ñ¥Ù”€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€‰¥ÌµÁ…ÕÍ•‰ôùí¥Ñ•´¹…Ñ¥Ù”€ü€‰Ñ¥Ù”ˆ€è€‰A…ÕÍ•‰ôð½•´øñ…Í¥‘”øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÑ½±•AÉ¥¥¹IÕ±” ‰…ÕÑ½µ…Ñ¥}‘¥Í½Õ¹ÑÌˆ°¥Ñ•´¹¥°€…¥Ñ•´¹…Ñ¥Ù”¥ôùí¥Ñ•´¹…Ñ¥Ù”€ü€‰A…ÕÍ”ˆ€è€‰Ñ¥Ù…Ñ”‰ôð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•µ½Ù•AÉ¥¥¹IÕ±” ‰…ÕÑ½µ…Ñ¥}‘¥Í½Õ¹ÑÌˆ°¥Ñ•´¹¥¥ôùI•µ½Ù”ð½‰ÕÑÑ½¸øð½…Í¥‘”øð½‘¥Øø¥ô(€€€€€€€€€€€ì…‘…Ñ„¹…ÕÑ½µ…Ñ¥¥Í½Õ¹ÑÌ¹±•¹Ñ €˜˜€ñÀù9¼…ÕÑ½µ…Ñ¥Œ‘¥Í½Õ¹ÑÌ½¹™¥ÕÉ•¸ð½Àùô(€€€€€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆøñ Ìù¡•­½ÕÐ½‘•Ìð½ Ìøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µ±¥ÍÐˆø(€€€€€€€€€€€í‘…Ñ„¹‘¥Í½Õ¹Ñ½‘•Ì¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÁÉ¥¥¹œµÉÕ±”ˆ­•äõí¥Ñ•´¹¥‘ôøñÍÁ…¸øñˆùí¥Ñ•´¹½‘•ôƒ
Üí9Õµ‰•È¡¥Ñ•´¹Á•É•¹Ñ…”¥ô”ð½ˆøñÍµ…±°ùí¥Ñ•´¹ÕÍ•}½Õ¹Ñõí¥Ñ•´¹µ…á}ÕÍ•Ì€ü€€¼€‘í¥Ñ•´¹µ…á}ÕÍ•Íõ€€è€ˆ‰ôÕÍ•Ìƒ
Üí¥Ñ•´¹µ¥¹}…É‘}½Õ¹Ð€ü€‘í¥Ñ•´¹µ¥¹}…É‘}½Õ¹Ñô¬…É‘Í€€è€‰9¼…Éµ¥¹¥µÕ´‰ôð½Íµ…±°øð½ÍÁ…¸øñ•´±…ÍÍ9…µ”õí¥Ñ•´¹…Ñ¥Ù”€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€‰¥ÌµÁ…ÕÍ•‰ôùí¥Ñ•´¹…Ñ¥Ù”€ü€‰Ñ¥Ù”ˆ€è€‰A…ÕÍ•‰ôð½•´øñ…Í¥‘”øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÑ½±•AÉ¥¥¹IÕ±” ‰‘¥Í½Õ¹Ñ}½‘•Ìˆ°¥Ñ•´¹¥°€…¥Ñ•´¹…Ñ¥Ù”¥ôùí¥Ñ•´¹…Ñ¥Ù”€ü€‰A…ÕÍ”ˆ€è€‰Ñ¥Ù…Ñ”‰ôð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•µ½Ù•AÉ¥¥¹IÕ±” ‰‘¥Í½Õ¹Ñ}½‘•Ìˆ°¥Ñ•´¹¥¥ôùI•µ½Ù”ð½‰ÕÑÑ½¸øð½…Í¥‘”øð½‘¥Øø¥ô(€€€€€€€€€€€ì…‘…Ñ„¹‘¥Í½Õ¹Ñ½‘•Ì¹±•¹Ñ €˜˜€ñÀù9¼‘¥Í½Õ¹Ð½‘•Ì½¹™¥ÕÉ•¸ð½Àùô(€€€€€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°…‘µ¥¸µ‰Õ¹‘±”µ½É‘•ÉÌˆøñ¡•…‘•È±…ÍÍ9…µ”ô‰…‘µ¥¸µ½É‘•Èµ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÍ9…µ”ô‰Ù…Õ±Ðµ½Ù•É±¥¹”ˆøÌ¬I=IILð½Àøñ Ìù	Õ¹‘±”½™™•ÉÌð½ Ìøð½‘¥ØøñÍÁ…¸ùí‘…Ñ„¹‰Õ¹‘±•=™™•ÉÌ¹™¥±Ñ•È ¡•¹ÑÉä¤€ôø•¹ÑÉä¹ÍÑ…ÑÕÌ€ôôô€‰Á•¹‘¥¹œˆ¤¹±•¹Ñ¡ôÁ•¹‘¥¹œð½ÍÁ…¸øð½¡•…‘•Èøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µ±¥ÍÐˆø(€€€€€€€€€í‘…Ñ„¹‰Õ¹‘±•=™™•ÉÌ¹µ…À ¡¥Ñ•´¤€ôø€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰…‘µ¥¸µ‰Õ¹‘±”µ½™™•Èˆ­•äõí¥Ñ•´¹¥‘ôøñÍÁ…¸øñˆùí¥Ñ•´¹‰Õå•Èü¹‘µ½}¹…µ”ñð¥Ñ•´¹‰Õå•Èü¹ÕÍ•É¹…µ”ñð€‰A±…å•È‰ôð½ˆøñÍµ…±°ùí¥Ñ•´¹…É‘}ÍÕµµ…Éåôð½Íµ…±°øñÍµ…±°ù1¥ÍÑ•í9Õµ‰•È¡¥Ñ•´¹±¥ÍÑ•‘}Ñ½Ñ…°¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ôƒ
ÜÁÉ½Á½Í•Ì€ñÍÑÉ½¹œùí9Õµ‰•È¡¥Ñ•´¹ÁÉ½Á½Í•‘}Ñ½Ñ…°¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ôð½ÍÑÉ½¹œùí¥Ñ•´¹½Õ¹Ñ•É}Ñ½Ñ…°€„ô¹Õ±°€ü€ƒ
Ü½Õ¹Ñ•È€‘í9Õµ‰•È¡¥Ñ•´¹½Õ¹Ñ•É}Ñ½Ñ…°¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ô€€è€ˆ‰ôð½Íµ…±°øð½ÍÁ…¸øñ•´±…ÍÍ9…µ”õí‰Õ¹‘±”µÍÑ…ÑÕÌÍÑ…ÑÕÌ´‘í¥Ñ•´¹ÍÑ…ÑÕÍõôùí¥Ñ•´¹ÍÑ…ÑÕÍôð½•´ùí¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰Á•¹‘¥¹œˆ€˜˜€ñ…Í¥‘”øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•ÍÁ½¹‘Q½	Õ¹‘±”¡¥Ñ•´¹¥°€‰…•ÁÑ•ˆ¥ôù•ÁÐ€¬¡…Ðð½‰ÕÑÑ½¸øñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÁ±…•¡½±‘•Èô‰½Õ¹Ñ•ÈÑ½Ñ…°ˆÙ…±Õ”õí‰Õ¹‘±•½Õ¹Ñ•ÉÍm¥Ñ•´¹¥‘t€üü€ˆ‰ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ	Õ¹‘±•½Õ¹Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°m¥Ñ•´¹¥‘tè”¹Ñ…É•Ð¹Ù…±Õ”ô¤¥ô€¼øñ‰ÕÑÑ½¸‘¥Í…‰±•õì…‰Õ¹‘±•½Õ¹Ñ•ÉÍm¥Ñ•´¹¥‘uô½¹±¥¬õì ¤€ôøÉ•ÍÁ½¹‘Q½	Õ¹‘±”¡¥Ñ•´¹¥°€‰½Õ¹Ñ•É•ˆ¥ôù½Õ¹Ñ•È€¬¡…Ðð½‰ÕÑÑ½¸øð½±…‰•°øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•ÍÁ½¹‘Q½	Õ¹‘±”¡¥Ñ•´¹¥°€‰‘•±¥¹•ˆ¥ôù•±¥¹”ð½‰ÕÑÑ½¸øð½…Í¥‘”ùõí¥Ñ•´¹¡…Ñ}¥€˜˜€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÝ¥¹‘½Ü¹±½…Ñ¥½¸¹…ÍÍ¥¸ ˆ½¡…ÑÌˆ¥ôù=Á•¸¡…Ðð½‰ÕÑÑ½¸ùôð½…ÉÑ¥±”ø¥ô(€€€€€€€€€ì…‘…Ñ„¹‰Õ¹‘±•=™™•ÉÌ¹±•¹Ñ €˜˜€ñÀù9¼‰Õ¹‘±”ÁÉ½Á½Í…±Ìå•Ð¸ð½Àùô(€€€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€ð½Í•Ñ¥½¸ùô((€€€€€íÑ…ˆ€ôôô€‰‰½½­Ìˆ€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µ‰½½­Ì…‘µ¥¸µ½É‘•ÈµÁ…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í…±•ÌµÍÕµµ…Éäˆøñ…ÉÑ¥±”øñÍµ…±°ùQ½Ñ…°½±ð½Íµ…±°øñÍÑÉ½¹œùíÑ½Ñ…±½±¹Ñ½1½…±•MÑÉ¥¹œ ¥ôð½ÍÑÉ½¹œøð½…ÉÑ¥±”øñ…ÉÑ¥±”øñÍµ…±°ù…É‘ÌÍ½±ð½Íµ…±°øñÍÑÉ½¹œùí…É‘ÍM½±‘ôð½ÍÑÉ½¹œøð½…ÉÑ¥±”øñ…ÉÑ¥±”øñÍµ…±°ùAÕÉ¡…Í•Ìð½Íµ…±°øñÍÑÉ½¹œùí‘…Ñ„¹ÁÕÉ¡…Í•Ì¹±•¹Ñ¡ôð½ÍÑÉ½¹œøð½…ÉÑ¥±”øð½‘¥Øø(€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆøñ¡•…‘•È±…ÍÍ9…µ”ô‰…‘µ¥¸µ½É‘•Èµ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÍ9…µ”ô‰Ù…Õ±Ðµ½Ù•É±¥¹”ˆùM1L1Hð½Àøñ Èù	Õä=É‘•ÉÌð½ Èøð½‘¥ØøñÍÁ…¸ùí‘…Ñ„¹ÁÕÉ¡…Í•Ì¹±•¹Ñ¡ôÉ•½É‘•ð½ÍÁ…¸øð½¡•…‘•ÈøñÀùÙ•Éä½µÁ±•Ñ•ÁÕÉ¡…Í”¥ÌÍ…Ù•¡•É”Ý¥Ñ ‰Õå•È°…É°ÁÉ¥”…¹Ñ¥µ”¸ð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µ±¥ÍÐˆø(€€€€€€€€€í‘…Ñ„¹ÁÕÉ¡…Í•Ì¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø­•äõí¥Ñ•´¹¥‘ô±…ÍÍ9…µ”ô‰…‘µ¥¸µÍ…±”ˆøñÍÁ…¸øñˆùí¥Ñ•´¹…Éü¹¹…µ”€üü¥Ñ•´¹…É‘}¹…µ”€üü€‰I•µ½Ù•…É‰ôð½ˆøñÍµ…±°ù	Õå•Èèí¥Ñ•´¹Á±…å•Èü¹ÕÍ•É¹…µ”€üü€‰A±…å•È‰ôƒ
Üí¥Ñ•´¹ÅÕ…¹Ñ¥Ñåô½Áä½½Á¥•Ìð½Íµ…±°øð½ÍÁ…¸øñÍÁ…¸øñˆùí9Õµ‰•È¡¥Ñ•´¹Á…¥‘}½±¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ôð½ˆøñÍµ…±°ùí¹•Ü…Ñ”¡¥Ñ•´¹É•…Ñ•‘}…Ð¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ôð½Íµ…±°øð½ÍÁ…¸øð½‘¥Øø¥ô(€€€€€€€€€ì…‘…Ñ„¹ÁÕÉ¡…Í•Ì¹±•¹Ñ €˜˜€ñÀù9¼ÁÕÉ¡…Í•Ì¡…Ù”‰••¸É•½É‘•å•Ð¸ð½Àùô(€€€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€ð½Í•Ñ¥½¸ùô((€€€€€íÑ…ˆ€ôôô€‰½µµÕ¹¥Ñäˆ€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µ½µµÕ¹¥Ñäµ½¹Í½±”ˆø(€€€€€€€€ñ¡•…‘•Èøñ‘¥ØøñÀ±…ÍÍ9…µ”ô‰Ù…Õ±Ðµ½Ù•É±¥¹”ˆùI5A%IQ4!990ð½Àøñ ÈùMÁ•…¬‘¥É•Ñ±äÑ¼Ñ¡”½µµÕ¹¥Ñä¸ð½ Èøð½‘¥Øøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÝ¥¹‘½Ü¹±½…Ñ¥½¸¹…ÍÍ¥¸ ˆ½½µµÕ¹¥Ñäˆ¥ôùY¥•ÜÁÕ‰±¥Œ½µµÕ¹¥ÑäƒŠ\ð½‰ÕÑÑ½¸øð½¡•…‘•Èø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ¥ˆø(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆ½¹MÕ‰µ¥ÐõíÁÕ‰±¥Í¡¹¹½Õ¹•µ•¹Ñôøñ‘µ¥¹%½¸¹…µ”ô‰½µµÕ¹¥Ñäˆ€¼øñ Ìù9•Ü…¹¹½Õ¹•µ•¹Ðð½ ÌøñÀùM•¹…¸½™™¥¥…°µ•ÍÍ…”Ñ¼•Ù•ÉäÙ•É¥™¥•Á±…å•È¸ð½Àøñ¥¹ÁÕÐÉ•ÅÕ¥É•Ù…±Õ”õí…‘µ¥¹¹¹½Õ¹•µ•¹Ð¹Ñ¥Ñ±•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ‘µ¥¹¹¹½Õ¹•µ•¹Ð¡ì€¸¸¹…‘µ¥¹¹¹½Õ¹•µ•¹Ð°Ñ¥Ñ±”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰¹¹½Õ¹•µ•¹ÐÑ¥Ñ±”ˆ€¼øñÑ•áÑ…É•„É•ÅÕ¥É•Ù…±Õ”õí…‘µ¥¹¹¹½Õ¹•µ•¹Ð¹‰½‘åô½¹¡…¹”õì¡”¤€ôøÍ•Ñ‘µ¥¹¹¹½Õ¹•µ•¹Ð¡ì€¸¸¹…‘µ¥¹¹¹½Õ¹•µ•¹Ð°‰½‘äè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰5•ÍÍ…”Ñ¼•Ù•ÉäÁ±…å•Èˆ€¼øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Ù…Õ±ÐµÍÕ‰µ¥ÐˆùAÕ‰±¥Í …¹¹½Õ¹•µ•¹Ðð½‰ÕÑÑ½¸øð½™½É´ø(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆ½¹MÕ‰µ¥ÐõíÁÕ‰±¥Í¡A½±±ôøñ‘µ¥¹%½¸¹…µ”ô‰½™™•ÉÌˆ€¼øñ Ìù9•Ü½µµÕ¹¥ÑäÁ½±°ð½ ÌøñÀùM•Á…É…Ñ”•… …¹ÍÝ•ÈÝ¥Ñ „½µµ„¸UÀÑ¼Í¥à½ÁÑ¥½¹Ì…É”ÍÕÁÁ½ÉÑ•¸ð½Àøñ¥¹ÁÕÐÉ•ÅÕ¥É•Ù…±Õ”õí…‘µ¥¹A½±°¹ÅÕ•ÍÑ¥½¹ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ‘µ¥¹A½±°¡ì€¸¸¹…‘µ¥¹A½±°°ÅÕ•ÍÑ¥½¸è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰½µµÕ¹¥ÑäÅÕ•ÍÑ¥½¸ˆ€¼øñ¥¹ÁÕÐÉ•ÅÕ¥É•Ù…±Õ”õí…‘µ¥¹A½±°¹½ÁÑ¥½¹Íô½¹¡…¹”õì¡”¤€ôøÍ•Ñ‘µ¥¹A½±°¡ì€¸¸¹…‘µ¥¹A½±°°½ÁÑ¥½¹Ìè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰=ÁÑ¥½¸½¹”°=ÁÑ¥½¸ÑÝ¼°=ÁÑ¥½¸Ñ¡É•”ˆ€¼øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Ù…Õ±ÐµÍÕ‰µ¥Ðˆù=Á•¸Á½±°ð½‰ÕÑÑ½¸øð½™½É´ø(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°…‘µ¥¸µ…Ù…¥±…‰¥±¥ÑäµÁ…¹•°ˆ½¹MÕ‰µ¥ÐõíÁÕ‰±¥Í¡Ù…¥±…‰¥±¥Ñåôøñ‘µ¥¹%½¸¹…µ”ô‰•Ù•¹ÑÌˆ€¼øñ ÌùA¥­ÕÀÉ•…‘¥¹•ÍÌð½ ÌøñÀùAÕ‰±¥Í Ý¡•¸å½Ô…É”½¹±¥¹”…¹Ý¡•¸ÕÍÑ½µ•ÉÌ…¸½±±•ÐÑ¡•¥È…É‘Ì¸ð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ¥¹ÁÕÐÉ•ÅÕ¥É•Ù…±Õ”õí…Ù…¥±…‰¥±¥Ñå½É´¹Ñ¥Ñ±•ô½¹¡…¹”õì¡”¤€ôøÍ•ÑÙ…¥±…‰¥±¥Ñå½É´¡ì€¸¸¹…Ù…¥±…‰¥±¥Ñå½É´°Ñ¥Ñ±”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰…ÉÁ¥­ÕÀˆ€¼øñ¥¹ÁÕÐÉ•ÅÕ¥É•Ù…±Õ”õí…Ù…¥±…‰¥±¥Ñå½É´¹±½…Ñ¥½¹ô½¹¡…¹”õì¡”¤€ôøÍ•ÑÙ…¥±…‰¥±¥Ñå½É´¡ì€¸¸¹…Ù…¥±…‰¥±¥Ñå½É´°±½…Ñ¥½¸è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰1½…Ñ¥½¸€¼Í•ÉÙ•Èˆ€¼øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÉ½Üˆøñ±…‰•°ù=¹±¥¹”™É½´ñ¥¹ÁÕÐÉ•ÅÕ¥É•ÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆÙ…±Õ”õí…Ù…¥±…‰¥±¥Ñå½É´¹ÍÑ…ÉÑÍ}…Ñô½¹¡…¹”õì¡”¤€ôøÍ•ÑÙ…¥±…‰¥±¥Ñå½É´¡ì€¸¸¹…Ù…¥±…‰¥±¥Ñå½É´°ÍÑ…ÉÑÍ}…Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øñ±…‰•°ù=¹±¥¹”Õ¹Ñ¥°ñ¥¹ÁÕÐÉ•ÅÕ¥É•ÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆÙ…±Õ”õí…Ù…¥±…‰¥±¥Ñå½É´¹•¹‘Í}…Ñô½¹¡…¹”õì¡”¤€ôøÍ•ÑÙ…¥±…‰¥±¥Ñå½É´¡ì€¸¸¹…Ù…¥±…‰¥±¥Ñå½É´°•¹‘Í}…Ðè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øð½‘¥ØøñÑ•áÑ…É•„Ù…±Õ”õí…Ù…¥±…‰¥±¥Ñå½É´¹¹½Ñ•ôµ…á1•¹Ñ ôˆØÀÀˆ½¹¡…¹”õì¡”¤€ôøÍ•ÑÙ…¥±…‰¥±¥Ñå½É´¡ì€¸¸¹…Ù…¥±…‰¥±¥Ñå½É´°¹½Ñ”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‰=ÁÑ¥½¹…°Á¥­ÕÀ¹½Ñ”ˆ€¼øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Ù…Õ±ÐµÍÕ‰µ¥ÐˆùAÕ‰±¥Í ±¥Ù”Ý¥¹‘½Üð½‰ÕÑÑ½¸øð½™½É´ø(€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°…‘µ¥¸µ…Ù…¥±…‰¥±¥Ñäµ±¥ÍÐˆøñ‘µ¥¹%½¸¹…µ”ô‰½µµÕ¹¥Ñäˆ€¼øñ ÌùAÕ‰±¥Í¡•Ý¥¹‘½ÝÌð½ ÌøñÀùQ¡•Í”Ñ¥µ•ÌÕÁ‘…Ñ”¥µµ•‘¥…Ñ•±ä™½È•Ù•ÉäÙ•É¥™¥•Á±…å•È¸ð½Àøñ‘¥Øùí‘…Ñ„¹…Ù…¥±…‰¥±¥Ñä¹µ…À ¡Í±½Ð¤€ôø€ñ…ÉÑ¥±”­•äõíÍ±½Ð¹¥‘ôøñÍÁ…¸øñˆùíÍ±½Ð¹Ñ¥Ñ±•ôð½ˆøñÍµ…±°ùí¹•Ü…Ñ”¡Í±½Ð¹ÍÑ…ÉÑÍ}…Ð¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ôƒŠLí¹•Ü…Ñ”¡Í±½Ð¹•¹‘Í}…Ð¤¹Ñ½1½…±•Q¥µ•MÑÉ¥¹œ¡mt°ì¡½ÕÈè€ˆÈµ‘¥¥Ðˆ°µ¥¹ÕÑ”è€ˆÈµ‘¥¥Ðˆô¥ôƒ
ÜíÍ±½Ð¹±½…Ñ¥½¹ôð½Íµ…±°øð½ÍÁ…¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•Ù…¥±…‰¥±¥Ñä¡Í±½Ð¹¥¥ôùI•µ½Ù”ð½‰ÕÑÑ½¸øð½…ÉÑ¥±”ø¥õì…‘…Ñ„¹…Ù…¥±…‰¥±¥Ñä¹±•¹Ñ €˜˜€ñÍµ…±°ù9¼Á¥­ÕÀÝ¥¹‘½ÝÌÁÕ‰±¥Í¡•¸ð½Íµ…±°ùôð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õì‰…‘µ¥¸µÁ…¹•°…‘µ¥¸µÁÉ•Í•¹”µÁ…¹•°ˆ€¬€¡‘…Ñ„¹ÁÉ•Í•¹”ü¹¥Í}½¹±¥¹”€ü€ˆ¥Ìµ½¹±¥¹”ˆ€è€ˆˆ¥ôøñ‘µ¥¹%½¸¹…µ”ô‰½µµÕ¹¥Ñäˆ€¼øñÀ±…ÍÍ9…µ”ô‰Ù…Õ±Ðµ½Ù•É±¥¹”ˆù1%YAIM9ð½Àøñ Ìùí‘…Ñ„¹ÁÉ•Í•¹”ü¹¥Í}½¹±¥¹”€ü€‰-…±•¹Í­¤¥Ì½¹±¥¹”ˆ€è€‰-…±•¹Í­¤¥Ì½™™±¥¹”‰ôð½ ÌøñÀùQ¡”Ñ¥­•È‰•±½ÜÑ¡”¹…Ù¥…Ñ¥½¸…ÁÁ•…ÉÌ½¹±äÝ¡¥±”Ñ¡¥ÌÍÝ¥Ñ ¥Ì½¹±¥¹”¸ð½Àøñ¥¹ÁÕÐµ…á1•¹Ñ ôˆÄÈÀˆÙ…±Õ”õíÁÉ•Í•¹•9½Ñ•ô½¹¡…¹”õì¡”¤€ôøÍ•ÑAÉ•Í•¹•9½Ñ”¡”¹Ñ…É•Ð¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‰M¡½ÉÐ±¥Ù”ÍÑ…ÑÕÌˆ€¼øñ‘¥Øøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Ù…Õ±ÐµÍÕ‰µ¥Ðˆ½¹±¥¬õì ¤€ôøÍ•ÑµÁ¥É•AÉ•Í•¹”¡ÑÉÕ”¥ôù¼½¹±¥¹”ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰…‘µ¥¸µÍ•½¹‘…Éäˆ½¹±¥¬õì ¤€ôøÍ•ÑµÁ¥É•AÉ•Í•¹”¡™…±Í”¥ôù¼½™™±¥¹”ð½‰ÕÑÑ½¸øð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°…‘µ¥¸µ½µµÕ¹¥Ñäµµ½‘•É…Ñ¥½¸ˆøñ‘µ¥¹%½¸¹…µ”ô‰½µµÕ¹¥Ñäˆ€¼øñ Ìù½µµÕ¹¥Ñäµ½‘•É…Ñ¥½¸ð½ ÌøñÀùMÕ•ÍÑ¥½¹Ì°É•Ù¥•ÝÌ…¹±•…ä™••‘‰…¬…¸‰”É•µ½Ù•¡•É”¸Q¡¥Ì½¹ÑÉ½°¥ÌÁÉ½Ñ•Ñ•‰ä…‘µ¥¹¥ÍÑÉ…Ñ½ÈI1L¸ð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µ±¥ÍÐˆø(€€€€€€€€€í‘…Ñ„¹½µµÕ¹¥ÑåMÕ•ÍÑ¥½¹Ì¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø­•äõì‰ÍÕ•ÍÑ¥½¸´ˆ€¬¥Ñ•´¹¥‘ôøñÍÁ…¸øñˆùMÕ•ÍÑ¥½¸ƒ
Üí¥Ñ•´¹Ñ¥Ñ±•ôð½ˆøñÍµ…±°ùí¥Ñ•´¹‰½‘åôð½Íµ…±°øð½ÍÁ…¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•½µµÕ¹¥Ñå¹ÑÉä ‰½µµÕ¹¥Ñå}ÍÕ•ÍÑ¥½¹Ìˆ°¥Ñ•´¹¥°€‰MÕ•ÍÑ¥½¸ˆ¥ôùI•µ½Ù”ð½‰ÕÑÑ½¸øð½‘¥Øø¥ô(€€€€€€€€€í‘…Ñ„¹½µµÕ¹¥ÑåI•Ù¥•ÝÌ¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø­•äõì‰É•Ù¥•Ü´ˆ€¬¥Ñ•´¹¥‘ôøñÍÁ…¸øñˆùI•Ù¥•Üƒ
Üí¥Ñ•´¹É…Ñ¥¹ô¼Ôð½ˆøñÍµ…±°ùí¥Ñ•´¹‰½‘åôð½Íµ…±°øð½ÍÁ…¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•½µµÕ¹¥Ñå¹ÑÉä ‰½µµÕ¹¥Ñå}É•Ù¥•ÝÌˆ°¥Ñ•´¹¥°€‰I•Ù¥•Üˆ¥ôùI•µ½Ù”ð½‰ÕÑÑ½¸øð½‘¥Øø¥ô(€€€€€€€€€í‘…Ñ„¹™••‘‰…¬¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø­•äõì‰™••‘‰…¬´ˆ€¬¥Ñ•´¹¥‘ôøñÍÁ…¸øñˆù1•…ä™••‘‰…¬ð½ˆøñÍµ…±°ùí¥Ñ•´¹µ•ÍÍ…•ôð½Íµ…±°øð½ÍÁ…¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•½µµÕ¹¥Ñå¹ÑÉä ‰™••‘‰…¬ˆ°¥Ñ•´¹¥°€‰••‘‰…¬ˆ¥ôùI•µ½Ù”ð½‰ÕÑÑ½¸øð½‘¥Øø¥ô(€€€€€€€€€ì…‘…Ñ„¹½µµÕ¹¥ÑåMÕ•ÍÑ¥½¹Ì¹±•¹Ñ €˜˜€…‘…Ñ„¹½µµÕ¹¥ÑåI•Ù¥•ÝÌ¹±•¹Ñ €˜˜€…‘…Ñ„¹™••‘‰…¬¹±•¹Ñ €˜˜€ñÀù9¼½µµÕ¹¥Ñä•¹ÑÉ¥•ÌÑ¼µ½‘•É…Ñ”¸ð½Àùô(€€€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€ð½Í•Ñ¥½¸ùô((€€€€€íÑ…ˆ€ôôô€‰Á±…å•ÉÌˆ€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ…¹•°ˆøñ ÈùA±…å•ÈÉ½±•Ìð½ ÈøñÀù•±•Ñ”É•µ½Ù•ÌÑ¡”Á±…å•ÈÁÉ½™¥±”…¹Ñ¡•¥ÈµÁ¥É”‘…Ñ„¸‘µ¥¹¥ÍÑÉ…Ñ½ÈÁÉ½™¥±•Ì…É”ÁÉ½Ñ•Ñ•¸ð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µ±¥ÍÐˆø(€€€€€€€í‘…Ñ„¹Á±…å•ÉÌ¹µ…À ¡¥Ñ•´¤€ôø€ñ‘¥Ø­•äõí¥Ñ•´¹¥‘ô±…ÍÍ9…µ”ô‰…‘µ¥¸µÁ±…å•ÈˆøñÍÁ…¸øñˆùí¥Ñ•´¹‘µ½}¹…µ”ñð¥Ñ•´¹ÕÍ•É¹…µ•ôð½ˆøñÍµ…±°ùí¥Ñ•´¹‘µ½}¹…µ”€ü¥Í½É ‘í¥Ñ•´¹ÕÍ•É¹…µ•õ€€èÉ½±•1…‰•±Ím¥Ñ•´¹É½±•t€üü€‰A±…å•È‰õí9Õµ‰•È¡¥Ñ•´¹Ý¥¹Ì¤ñð9Õµ‰•È¡¥Ñ•´¹±½ÍÍ•Ì¤€ü€ƒ
Ü€‘í¥Ñ•´¹Ý¥¹Íõ\€¼€‘í¥Ñ•´¹±½ÍÍ•Íõ1€€è€ˆ‰ôð½Íµ…±°øð½ÍÁ…¸øñÍ•±•ÐÙ…±Õ”õíÉ½±•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹É½±”¤€ü¥Ñ•´¹É½±”€è€‰ÕÍÑ½µ•È‰ô½¹¡…¹”õì¡”¤€ôøÍ•ÑI½±”¡¥Ñ•´¹¥°”¹Ñ…É•Ð¹Ù…±Õ”¥ôùíÉ½±•Ì¹µ…À ¡É½±”¤€ôø€ñ½ÁÑ¥½¸­•äõíÉ½±•ôÙ…±Õ”õíÉ½±•ôùíÉ½±•1…‰•±ÍmÉ½±•uôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðùí¥Ñ•´¹¥€„ôôÁÉ½™¥±”¹¥€˜˜¥Ñ•´¹É½±”€„ôô€‰…‘µ¥¸ˆ€˜˜€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰…‘µ¥¸µ‘•±•Ñ”µÁ±…å•Èˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•A±…å•È¡¥Ñ•´¹¥°¥Ñ•´¹‘µ½}¹…µ”ñð¥Ñ•´¹ÕÍ•É¹…µ”¥ôù•±•Ñ”Á±…å•Èð½‰ÕÑÑ½¸ùôð½‘¥Øø¥ô(€€€€€€ð½‘¥Øøð½Í•Ñ¥½¸ùô(€€€€ð½µ…¥¸ø(€€¤ì)ô(