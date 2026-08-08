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

function catalogMatchScore(cardName, searchValue) {
  const name = normaliseCardName(cardName);
  const query = normaliseCardName(searchValue);
  if (!name || !query) return 0;
  if (name === query) return 1;
  if (name.startsWith(query)) return .97;
  if (name.includes(query)) return .9;

  const nameTokens = name.split(" ");
  const queryTokens = query.split(" ");
  const tokenScore = queryTokens.reduce((sum, queryToken) => {
    const bestToken = nameTokens.reduce((best, nameToken) => {
      if (nameToken === queryToken) return 1;
      if (nameToken.startsWith(queryToken) || queryToken.startsWith(nameToken)) return Math.max(best, .92);
      return Math.max(best, textSimilarity(nameToken, queryToken));
    }, 0);
    return sum + bestToken;
  }, 0) / queryTokens.length;

  return Math.max(textSimilarity(name, query), tokenScore * .94);
}

function searchOfficialCatalog(searchValue, limit = 8) {
  const query = normaliseCardName(searchValue);
  if (query.length < 2) return [];
  const minimumScore = query.length <= 3 ? .62 : .48;
  return officialDmoCatalog
    .map((item) => ({ ...item, matchScore: catalogMatchScore(item.name, query) }))
    .filter((item) => item.matchScore >= minimumScore)
    .sort((left, right) => right.matchScore - left.matchScore || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function detectCatalogCards(ocrText) {
  const lines = String(ocrText ?? "")
    .split(/\r?\n/)
    .map((line) => normaliseCardName(line.replace(/^\d+\s*/, "")))
    .filter((line) => line.length > 2 && line.length < 90);
  const matches = new Map();

  for (const line of lines) {
    const candidate = searchOfficialCatalog(line, 1)[0];
    if (!candidate || candidate.matchScore < .54) continue;
    const key = normaliseCardName(candidate.name);
    const existing = matches.get(key);
    const confidence = Math.round(candidate.matchScore * 100);
    matches.set(key, existing
      ? { ...existing, quantity: existing.quantity + 1, confidence: Math.max(existing.confidence, confidence) }
      : { ...candidate, quantity: 1, confidence });
  }

  return [...matches.values()]
    .sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name))
    .slice(0, 60);
}

async function createInventoryTitleSheet(file) {
  const bitmap = await createImageBitmap(file);
  const aspect = bitmap.width / bitmap.height;
  const columns = aspect >= 1.35 ? 10 : aspect >= 1 ? 8 : 6;
  const cellWidth = bitmap.width / columns;
  const rows = Math.max(1, Math.round((bitmap.height * columns * .9) / bitmap.width));
  const cardCount = columns * rows;
  const sheet = document.createElement("canvas");
  sheet.width = 760;
  sheet.height = cardCount * 72;
  const context = sheet.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, sheet.width, sheet.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "grayscale(1) contrast(2.4) brightness(1.18)";

  for (let index = 0; index < cardCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellHeight = bitmap.height / rows;
    context.drawImage(
      bitmap,
      column * cellWidth + cellWidth * .035,
      row * cellHeight + cellHeight * .005,
      cellWidth * .93,
      cellHeight * .19,
      12,
      index * 72 + 8,
      736,
      52,
    );
  }
  context.filter = "none";
  bitmap.close?.();
  return sheet;
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

    const localMatches = searchOfficialCatalog(term);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestions(localMatches);
      setCatalogLoading(true);
      try {
        const response = await fetch("/api/card-catalog?q=" + encodeURIComponent(term), { signal: controller.signal });
        const payload = response.ok ? await response.json() : null;
        if (payload?.cards?.length) {
          const artwork = new Map(payload.cards.map((item) => [normaliseCardName(item.name), item]));
          const merged = localMatches.map((item) => ({ ...item, ...(artwork.get(normaliseCardName(item.name)) ?? {}) }));
          setSuggestions(merged.length ? merged : payload.cards);
        }
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
    setNotice("Reading card names from the screenshot ×M<ÞÚ$z{-®éÜj×vWÓÂ÷6ÖÆÃçÓÂ÷7ããÆVÓç¶—FVÒç7FGW7ÓÂöVÓç¶—FVÒç7FGW2ÓÓÒ'VæF–ær"bbÆ6–FSãÆ'WGFöâöä6Æ–6³×²‚’Óâ&W7öæEFõG&FR†—FVÒæ–BÂ&66WFVB"—Óä66WB²6†CÂö'WGFöããÆ'WGFöâöä6Æ–6³×²‚’Óâ&W7öæEFõG&FR†—FVÒæ–BÂ&æVv÷F–F–ær"—ÓäæVv÷F–FR²6†CÂö'WGFöããÆ'WGFöâöä6Æ–6³×²‚’Óâ&W7öæEFõG&FR†—FVÒæ–BÂ&FV6Æ–æVB"—ÓäFV6Æ–æSÂö'WGFöããÂö6–FSç×¶—FVÒæ6†Eö–BbbÆ6–FSãÆ'WGFöâöä6Æ–6³×²‚’Óâv–æF÷ræÆö6F–öâæ76–vâ‚"ö6†G2"—Óä÷Vâ6†CÂö'WGFöããÂö6–FSçÓÂöF—câ—Ð¢²FFçG&FW2æÆVæwF‚bbÇäæòG&FR‡V"öffW'2–WBãÂ÷çÐ¢ÂöF—cãÂ÷6V7F–öãçÐ ¢·F"ÓÓÒ'&–6–ær"bbÇ6V7F–öâ6Æ74æÖSÒ&FÖ–â×&–6–ærÖ6öç6öÆR#à¢Æ†VFW"6Æ74æÖSÒ&FÖ–âÖ÷&FW"Ö†VF–ær#ãÆF—cãÇ6Æ74æÖSÒ'fVÇBÖ÷fW&Æ–æR#å$”4R4ôåE$ôÃÂ÷ãÆƒ#äF—66÷VçG2b'VæFÆRöffW'3Âöƒ#ãÂöF—cãÇ7ãå6W'fW"fW&–f–VCÂ÷7ããÂö†VFW#à¢ÆF—b6Æ74æÖSÒ&FÖ–âÖw&–BFÖ–â×&–6–ærÖf÷&×2#à¢Æf÷&Ò6Æ74æÖSÒ&FÖ–â×æVÂ"öå7V&Ö—C×¶7&VFTWFöÖF–4F—66÷VçGÓà¢ÄFÖ–ä–6öâæÖSÒ'&–6–ær"óãÆƒ3äWFöÖF–2F—66÷VçCÂöƒ3ãÇäÆ–W2WFöÖF–6ÆÇ’v†VâF†R7F—fRF–ÖRæBÖ–æ–×VÒ÷&FW"'VÆW2ÖF6‚ãÂ÷à¢ÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆ–çWB&WV—&VBÖ„ÆVæwFƒÒ#ƒ"Æ6V†öÆFW#Ò$6×–vâæÖR"fÇVS×¶F—66÷VçDf÷&ÒææÖWÒöä6†ævS×²†R’Óâ6WDF—66÷VçDf÷&Ò‡²ââæF—66÷VçDf÷&ÒÂæÖS¢RçF&vWBçfÇVRÒ—ÒóãÆ–çWB&WV—&VBG—SÒ&çVÖ&W""Ö–ãÒ#ã"ÖƒÒ#“"7FWÒ#ã"Æ6V†öÆFW#Ò$F—66÷VçBR"fÇVS×¶F—66÷VçDf÷&ÒçW&6VçFvWÒöä6†ævS×²†R’Óâ6WDF—66÷VçDf÷&Ò‡²ââæF—66÷VçDf÷&ÒÂW&6VçFvS¢RçF&vWBçfÇVRÒ—ÒóãÂöF—cà¢ÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆÆ&VÃå7F'G3Æ–çWBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×¶F—66÷VçDf÷&Òç7F'G5öGÒöä6†ævS×²†R’Óâ6WDF—66÷VçDf÷&Ò‡²ââæF—66÷VçDf÷&ÒÂ7F'G5öC¢RçF&vWBçfÇVRÒ—ÒóãÂöÆ&VÃãÆÆ&VÃäVæG3Æ–çWBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×¶F—66÷VçDf÷&ÒæVæG5öGÒöä6†ævS×²†R’Óâ6WDF—66÷VçDf÷&Ò‡²ââæF—66÷VçDf÷&ÒÂVæG5öC¢RçF&vWBçfÇVRÒ—ÒóãÂöÆ&VÃãÂöF—cà¢ÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò$Ö–æ–×VÒF÷FÂ"fÇVS×¶F—66÷VçDf÷&ÒæÖ–å÷F÷FÇÒöä6†ævS×²†R’Óâ6WDF—66÷VçDf÷&Ò‡²ââæF—66÷VçDf÷&ÒÂÖ–å÷F÷FÃ¢RçF&vWBçfÇVRÒ—ÒóãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò$Ö–æ–×VÒ6&B6÷VçB"fÇVS×¶F—66÷VçDf÷&ÒæÖ–åö6&Eö6÷VçGÒöä6†ævS×²†R’Óâ6WDF—66÷VçDf÷&Ò‡²ââæF—66÷VçDf÷&ÒÂÖ–åö6&Eö6÷VçC¢RçF&vWBçfÇVRÒ—ÒóãÂöF—cà¢Æ'WGFöâ6Æ74æÖSÒ'fVÇB×7V&Ö—B#åV&Æ—6‚WFöÖF–2F—66÷VçCÂö'WGFöãà¢Âöf÷&Óà¢Æf÷&Ò6Æ74æÖSÒ&FÖ–â×æVÂ"öå7V&Ö—C×¶7&VFTF—66÷VçD6öFWÓà¢ÄFÖ–ä–6öâæÖSÒ&öffW'2"óãÆƒ3äF—66÷VçB6öFSÂöƒ3ãÇä7&VFR&—fFR6†V6¶÷WB6öFRv—F‚—G2÷vâÆ–Ö—G2æB7F—fRW&–öBãÂ÷à¢ÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆ–çWB&WV—&VBÖ–äÆVæwFƒÒ#2"Ö„ÆVæwFƒÒ#3""Æ6V†öÆFW#Ò$4ôDR"fÇVS×¶6öFTf÷&Òæ6öFWÒöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂ6öFS¢RçF&vWBçfÇVRçFõWW$66R‚’ç&WÆ6R‚õµäÕ£Ó•òÕÒörÂ""’Ò—ÒóãÆ–çWB&WV—&VBG—SÒ&çVÖ&W""Ö–ãÒ#ã"ÖƒÒ#“"7FWÒ#ã"Æ6V†öÆFW#Ò$F—66÷VçBR"fÇVS×¶6öFTf÷&ÒçW&6VçFvWÒöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂW&6VçFvS¢RçF&vWBçfÇVRÒ—ÒóãÂöF—cà¢ÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆÆ&VÃå7F'G3Æ–çWBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×¶6öFTf÷&Òç7F'G5öGÒöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂ7F'G5öC¢RçF&vWBçfÇVRÒ—ÒóãÂöÆ&VÃãÆÆ&VÃäVæG3Æ–çWBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×¶6öFTf÷&ÒæVæG5öGÒöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂVæG5öC¢RçF&vWBçfÇVRÒ—ÒóãÂöÆ&VÃãÂöF—cà¢ÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò$Ö–æ–×VÒF÷FÂ"fÇVS×¶6öFTf÷&ÒæÖ–å÷F÷FÇÒöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂÖ–å÷F÷FÃ¢RçF&vWBçfÇVRÒ—ÒóãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò$Ö–æ–×VÒ6&G2"fÇVS×¶6öFTf÷&ÒæÖ–åö6&Eö6÷VçGÒöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂÖ–åö6&Eö6÷VçC¢RçF&vWBçfÇVRÒ—ÒóãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò$Ö‚W6W2"fÇVS×¶6öFTf÷&ÒæÖ…÷W6W7Òöä6†ævS×²†R’Óâ6WD6öFTf÷&Ò‡²ââæ6öFTf÷&ÒÂÖ…÷W6W3¢RçF&vWBçfÇVRÒ—ÒóãÂöF—cà¢Æ'WGFöâ6Æ74æÖSÒ'fVÇB×7V&Ö—B#ä7&VFRF—66÷VçB6öFSÂö'WGFöãà¢Âöf÷&Óà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&FÖ–âÖw&–BFÖ–â×&–6–ærÖÆ—7G2#à¢Ç6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂ#ãÆƒ3äWFöÖF–26×–vç3Âöƒ3ãÆF—b6Æ74æÖSÒ&FÖ–âÖÆ—7B#à¢¶FFæWFöÖF–4F—66÷VçG2æÖ‚†—FVÒ’ÓâÆF—b6Æ74æÖSÒ&FÖ–â×&–6–ær×'VÆR"¶W“×¶—FVÒæ–GÓãÇ7ããÆ#ç¶—FVÒææÖWÒ+r´çVÖ&W"†—FVÒçW&6VçFvR—ÒSÂö#ãÇ6ÖÆÃç¶—FVÒæÖ–åö6&Eö6÷VçBòG¶—FVÒæÖ–åö6&Eö6÷VçGÒ²6&G6¢$ç’6&B6÷VçB'Ò+r´çVÖ&W"†—FVÒæÖ–å÷F÷FÂ’çFôÆö6ÆU7G&–ær‚—ÒrÖ–æ–×VÓÂ÷6ÖÆÃãÂ÷7ããÆVÒ6Æ74æÖS×¶—FVÒæ7F—fRò&—2Ö7F—fR"¢&—2×W6VB'Óç¶—FVÒæ7F—fRò$7F—fR"¢%W6VB'ÓÂöVÓãÆ6–FSãÆ'WGFöâöä6Æ–6³×²‚’ÓâFövvÆU&–6–æu'VÆR‚&WFöÖF–5öF—66÷VçG2"Â—FVÒæ–BÂ—FVÒæ7F—fR—Óç¶—FVÒæ7F—fRò%W6R"¢$7F—fFR'ÓÂö'WGFöããÆ'WGFöâöä6Æ–6³×²‚’Óâ&VÖ÷fU&–6–æu'VÆR‚&WFöÖF–5öF—66÷VçG2"Â—FVÒæ–B—Óå&VÖ÷fSÂö'WGFöããÂö6–FSãÂöF—câ—Ð¢²FFæWFöÖF–4F—66÷VçG2æÆVæwF‚bbÇäæòWFöÖF–2F—66÷VçG26öæf–wW&VBãÂ÷çÐ¢ÂöF—cãÂ÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂ#ãÆƒ3ä6†V6¶÷WB6öFW3Âöƒ3ãÆF—b6Æ74æÖSÒ&FÖ–âÖÆ—7B#à¢¶FFæF—66÷VçD6öFW2æÖ‚†—FVÒ’ÓâÆF—b6Æ74æÖSÒ&FÖ–â×&–6–ær×'VÆR"¶W“×¶—FVÒæ–GÓãÇ7ããÆ#ç¶—FVÒæ6öFWÒ+r´çVÖ&W"†—FVÒçW&6VçFvR—ÒSÂö#ãÇ6ÖÆÃç¶—FVÒçW6Uö6÷VçG×¶—FVÒæÖ…÷W6W2òòG¶—FVÒæÖ…÷W6W7Ö¢"'ÒW6W2+r¶—FVÒæÖ–åö6&Eö6÷VçBòG¶—FVÒæÖ–åö6&Eö6÷VçGÒ²6&G6¢$æò6&BÖ–æ–×VÒ'ÓÂ÷6ÖÆÃãÂ÷7ããÆVÒ6Æ74æÖS×¶—FVÒæ7F—fRò&—2Ö7F—fR"¢&—2×W6VB'Óç¶—FVÒæ7F—fRò$7F—fR"¢%W6VB'ÓÂöVÓãÆ6–FSãÆ'WGFöâöä6Æ–6³×²‚’ÓâFövvÆU&–6–æu'VÆR‚&F—66÷VçEö6öFW2"Â—FVÒæ–BÂ—FVÒæ7F—fR—Óç¶—FVÒæ7F—fRò%W6R"¢$7F—fFR'ÓÂö'WGFöããÆ'WGFöâöä6Æ–6³×²‚’Óâ&VÖ÷fU&–6–æu'VÆR‚&F—66÷VçEö6öFW2"Â—FVÒæ–B—Óå&VÖ÷fSÂö'WGFöããÂö6–FSãÂöF—câ—Ð¢²FFæF—66÷VçD6öFW2æÆVæwF‚bbÇäæòF—66÷VçB6öFW26öæf–wW&VBãÂ÷çÐ¢ÂöF—cãÂ÷6V7F–öãà¢ÂöF—cà ¢Ç6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂFÖ–âÖ'VæFÆRÖ÷&FW'2#ãÆ†VFW"6Æ74æÖSÒ&FÖ–âÖ÷&FW"Ö†VF–ær#ãÆF—cãÇ6Æ74æÖSÒ'fVÇBÖ÷fW&Æ–æR#ã2²4$Bõ$DU%3Â÷ãÆƒ3ä'VæFÆRöffW'3Âöƒ3ãÂöF—cãÇ7ãç¶FFæ'VæFÆTöffW'2æf–ÇFW"‚†VçG'’’ÓâVçG'’ç7FGW2ÓÓÒ'VæF–ær"’æÆVæwF‡ÒVæF–æsÂ÷7ããÂö†VFW#ãÆF—b6Æ74æÖSÒ&FÖ–âÖÆ—7B#à¢¶FFæ'VæFÆTöffW'2æÖ‚†—FVÒ’ÓâÆ'F–6ÆR6Æ74æÖSÒ&FÖ–âÖ'VæFÆRÖöffW""¶W“×¶—FVÒæ–GÓãÇ7ããÆ#ç¶—FVÒæ'W–W#òæFÖõöæÖRÇÂ—FVÒæ'W–W#òçW6W&æÖRÇÂ%Æ–W"'ÓÂö#ãÇ6ÖÆÃç¶—FVÒæ6&E÷7VÖÖ'—ÓÂ÷6ÖÆÃãÇ6ÖÆÃäÆ—7FVB´çVÖ&W"†—FVÒæÆ—7FVE÷F÷FÂ’çFôÆö6ÆU7G&–ær‚—Òr+r&÷÷6W2Ç7G&öæsç´çVÖ&W"†—FVÒç&÷÷6VE÷F÷FÂ’çFôÆö6ÆU7G&–ær‚—ÒsÂ÷7G&öæsç¶—FVÒæ6÷VçFW%÷F÷FÂÒçVÆÂò+r6÷VçFW"G´çVÖ&W"†—FVÒæ6÷VçFW%÷F÷FÂ’çFôÆö6ÆU7G&–ær‚—Òv¢"'ÓÂ÷6ÖÆÃãÂ÷7ããÆVÒ6Æ74æÖS×¶'VæFÆR×7FGW27FGW2ÒG¶—FVÒç7FGW7ÖÓç¶—FVÒç7FGW7ÓÂöVÓç¶—FVÒç7FGW2ÓÓÒ'VæF–ær"bbÆ6–FSãÆ'WGFöâöä6Æ–6³×²‚’Óâ&W7öæEFô'VæFÆR†—FVÒæ–BÂ&66WFVB"—Óä66WB²6†CÂö'WGFöããÆÆ&VÃãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò$6÷VçFW"F÷FÂ"fÇVS×¶'VæFÆT6÷VçFW'5¶—FVÒæ–EÒóò"'Òöä6†ævS×²†R’Óâ6WD'VæFÆT6÷VçFW'2‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ¶—FVÒæ–EÓ¢RçF&vWBçfÇVRÒ’—ÒóãÆ'WGFöâF—6&ÆVC×²'VæFÆT6÷VçFW'5¶—FVÒæ–E×Òöä6Æ–6³×²‚’Óâ&W7öæEFô'VæFÆR†—FVÒæ–BÂ&6÷VçFW&VB"—Óä6÷VçFW"²6†CÂö'WGFöããÂöÆ&VÃãÆ'WGFöâöä6Æ–6³×²‚’Óâ&W7öæEFô'VæFÆR†—FVÒæ–BÂ&FV6Æ–æVB"—ÓäFV6Æ–æSÂö'WGFöããÂö6–FSç×¶—FVÒæ6†Eö–BbbÆ'WGFöâöä6Æ–6³×²‚’Óâv–æF÷ræÆö6F–öâæ76–vâ‚"ö6†G2"—Óä÷Vâ6†CÂö'WGFöãçÓÂö'F–6ÆSâ—Ð¢²FFæ'VæFÆTöffW'2æÆVæwF‚bbÇäæò'VæFÆR&÷÷6Ç2–WBãÂ÷çÐ¢ÂöF—cãÂ÷6V7F–öãà¢Â÷6V7F–öãçÐ ¢·F"ÓÓÒ&&öö·2"bbÇ6V7F–öâ6Æ74æÖSÒ&FÖ–âÖ&öö·2FÖ–âÖ÷&FW"×æVÂ#à¢ÆF—b6Æ74æÖSÒ'6ÆW2×7VÖÖ'’#ãÆ'F–6ÆSãÇ6ÖÆÃåF÷FÂvöÆCÂ÷6ÖÆÃãÇ7G&öæsç·F÷FÄvöÆBçFôÆö6ÆU7G&–ær‚—ÒsÂ÷7G&öæsãÂö'F–6ÆSãÆ'F–6ÆSãÇ6ÖÆÃä6&G26öÆCÂ÷6ÖÆÃãÇ7G&öæsç¶6&G56öÆGÓÂ÷7G&öæsãÂö'F–6ÆSãÆ'F–6ÆSãÇ6ÖÆÃåW&6†6W3Â÷6ÖÆÃãÇ7G&öæsç¶FFçW&6†6W2æÆVæwF‡ÓÂ÷7G&öæsãÂö'F–6ÆSãÂöF—cà¢Ç6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂ#ãÆ†VFW"6Æ74æÖSÒ&FÖ–âÖ÷&FW"Ö†VF–ær#ãÆF—cãÇ6Æ74æÖSÒ'fVÇBÖ÷fW&Æ–æR#å4ÄU2ÄTDtU#Â÷ãÆƒ#ä'W’÷&FW'3Âöƒ#ãÂöF—cãÇ7ãç¶FFçW&6†6W2æÆVæwF‡Ò&V6÷&FVCÂ÷7ããÂö†VFW#ãÇäWfW'’6ö×ÆWFVBW&6†6R—26fVB†W&Rv—F‚'W–W"Â6&BÂ&–6RæBF–ÖRãÂ÷ãÆF—b6Æ74æÖSÒ&FÖ–âÖÆ—7B#à¢¶FFçW&6†6W2æÖ‚†—FVÒ’ÓâÆF—b¶W“×¶—FVÒæ–GÒ6Æ74æÖSÒ&FÖ–â×6ÆR#ãÇ7ããÆ#ç¶—FVÒæ6&CòææÖRóò—FVÒæ6&EöæÖRóò%&VÖ÷fVB6&B'ÓÂö#ãÇ6ÖÆÃä'W–W#¢¶—FVÒçÆ–W#òçW6W&æÖRóò%Æ–W"'Ò+r¶—FVÒçVçF—G—Ò6÷’ö6÷–W3Â÷6ÖÆÃãÂ÷7ããÇ7ããÆ#ç´çVÖ&W"†—FVÒç–EövöÆB’çFôÆö6ÆU7G&–ær‚—ÒsÂö#ãÇ6ÖÆÃç¶æWrFFR†—FVÒæ7&VFVEöB’çFôÆö6ÆU7G&–ær‚—ÓÂ÷6ÖÆÃãÂ÷7ããÂöF—câ—Ð¢²FFçW&6†6W2æÆVæwF‚bbÇäæòW&6†6W2†fR&VVâ&V6÷&FVB–WBãÂ÷çÐ¢ÂöF—cãÂ÷6V7F–öãà¢Â÷6V7F–öãçÐ ¢·F"ÓÓÒ&6öÖ×Væ—G’"bbÇ6V7F–öâ6Æ74æÖSÒ&FÖ–âÖ6öÖ×Væ—G’Ö6öç6öÆR#à¢Æ†VFW#ãÆF—cãÇ6Æ74æÖSÒ'fVÇBÖ÷fW&Æ–æR#ä4$BTÕ•$RDTÒ4„ääTÃÂ÷ãÆƒ#å7V²F—&V7FÇ’FòF†R6öÖ×Væ—G’ãÂöƒ#ãÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâv–æF÷ræÆö6F–öâæ76–vâ‚"ö6öÖ×Væ—G’"—Óåf–WrV&Æ–26öÖ×Væ—G’(isÂö'WGFöããÂö†VFW#à¢ÆF—b6Æ74æÖSÒ&FÖ–âÖw&–B#à¢Æf÷&Ò6Æ74æÖSÒ&FÖ–â×æVÂ"öå7V&Ö—C×·V&Æ—6„ææ÷Væ6VÖVçGÓãÄFÖ–ä–6öâæÖSÒ&6öÖ×Væ—G’"óãÆƒ3äæWrææ÷Væ6VÖVçCÂöƒ3ãÇå6VæBâöff–6–ÂÖW76vRFòWfW'’fW&–f–VBÆ–W"ãÂ÷ãÆ–çWB&WV—&VBfÇVS×¶FÖ–äææ÷Væ6VÖVçBçF—FÆWÒöä6†ævS×²†R’Óâ6WDFÖ–äææ÷Væ6VÖVçB‡²ââæFÖ–äææ÷Væ6VÖVçBÂF—FÆS¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$ææ÷Væ6VÖVçBF—FÆR"óãÇFW‡F&V&WV—&VBfÇVS×¶FÖ–äææ÷Væ6VÖVçBæ&öG—Òöä6†ævS×²†R’Óâ6WDFÖ–äææ÷Væ6VÖVçB‡²ââæFÖ–äææ÷Væ6VÖVçBÂ&öG“¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$ÖW76vRFòWfW'’Æ–W""óãÆ'WGFöâ6Æ74æÖSÒ'fVÇB×7V&Ö—B#åV&Æ—6‚ææ÷Væ6VÖVçCÂö'WGFöããÂöf÷&Óà¢Æf÷&Ò6Æ74æÖSÒ&FÖ–â×æVÂ"öå7V&Ö—C×·V&Æ—6…öÆÇÓãÄFÖ–ä–6öâæÖSÒ&öffW'2"óãÆƒ3äæWr6öÖ×Væ—G’öÆÃÂöƒ3ãÇå6W&FRV6‚ç7vW"v—F‚6öÖÖâWFò6—‚÷F–öç2&R7W÷'FVBãÂ÷ãÆ–çWB&WV—&VBfÇVS×¶FÖ–åöÆÂçVW7F–öçÒöä6†ævS×²†R’Óâ6WDFÖ–åöÆÂ‡²ââæFÖ–åöÆÂÂVW7F–öã¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$6öÖ×Væ—G’VW7F–öâ"óãÆ–çWB&WV—&VBfÇVS×¶FÖ–åöÆÂæ÷F–öç7Òöä6†ævS×²†R’Óâ6WDFÖ–åöÆÂ‡²ââæFÖ–åöÆÂÂ÷F–öç3¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$÷F–öâöæRÂ÷F–öâGvòÂ÷F–öâF‡&VR"óãÆ'WGFöâ6Æ74æÖSÒ'fVÇB×7V&Ö—B#ä÷VâöÆÃÂö'WGFöããÂöf÷&Óà¢Æf÷&Ò6Æ74æÖSÒ&FÖ–â×æVÂFÖ–âÖf–Æ&–Æ—G’×æVÂ"öå7V&Ö—C×·V&Æ—6„f–Æ&–Æ—G—ÓãÄFÖ–ä–6öâæÖSÒ&WfVçG2"óãÆƒ3å–6·W&VF–æW73Âöƒ3ãÇåV&Æ—6‚v†Vâ–÷R&RöæÆ–æRæBv†Vâ7W7FöÖW'26â6öÆÆV7BF†V—"6&G2ãÂ÷ãÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆ–çWB&WV—&VBfÇVS×¶f–Æ&–Æ—G”f÷&ÒçF—FÆWÒöä6†ævS×²†R’Óâ6WDf–Æ&–Æ—G”f÷&Ò‡²ââæf–Æ&–Æ—G”f÷&ÒÂF—FÆS¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$6&B–6·W"óãÆ–çWB&WV—&VBfÇVS×¶f–Æ&–Æ—G”f÷&ÒæÆö6F–öçÒöä6†ævS×²†R’Óâ6WDf–Æ&–Æ—G”f÷&Ò‡²ââæf–Æ&–Æ—G”f÷&ÒÂÆö6F–öã¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$Æö6F–öâò6W'fW""óãÂöF—cãÆF—b6Æ74æÖSÒ&FÖ–â×&÷r#ãÆÆ&VÃäöæÆ–æRg&öÓÆ–çWB&WV—&VBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×¶f–Æ&–Æ—G”f÷&Òç7F'G5öGÒöä6†ævS×²†R’Óâ6WDf–Æ&–Æ—G”f÷&Ò‡²ââæf–Æ&–Æ—G”f÷&ÒÂ7F'G5öC¢RçF&vWBçfÇVRÒ—ÒóãÂöÆ&VÃãÆÆ&VÃäöæÆ–æRVçF–ÃÆ–çWB&WV—&VBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×¶f–Æ&–Æ—G”f÷&ÒæVæG5öGÒöä6†ævS×²†R’Óâ6WDf–Æ&–Æ—G”f÷&Ò‡²ââæf–Æ&–Æ—G”f÷&ÒÂVæG5öC¢RçF&vWBçfÇVRÒ—ÒóãÂöÆ&VÃãÂöF—cãÇFW‡F&VfÇVS×¶f–Æ&–Æ—G”f÷&Òææ÷FWÒÖ„ÆVæwFƒÒ#c"öä6†ævS×²†R’Óâ6WDf–Æ&–Æ—G”f÷&Ò‡²ââæf–Æ&–Æ—G”f÷&ÒÂæ÷FS¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò$÷F–öæÂ–6·Wæ÷FR"óãÆ'WGFöâ6Æ74æÖSÒ'fVÇB×7V&Ö—B#åV&Æ—6‚Æ—fRv–æF÷sÂö'WGFöããÂöf÷&Óà¢Ç6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂFÖ–âÖf–Æ&–Æ—G’ÖÆ—7B#ãÄFÖ–ä–6öâæÖSÒ&6öÖ×Væ—G’"óãÆƒ3åV&Æ—6†VBv–æF÷w3Âöƒ3ãÇåF†W6RF–ÖW2WFFR–ÖÖVF–FVÇ’f÷"WfW'’fW&–f–VBÆ–W"ãÂ÷ãÆF—cç¶FFæf–Æ&–Æ—G’æÖ‚‡6Æ÷B’ÓâÆ'F–6ÆR¶W“×·6Æ÷Bæ–GÓãÇ7ããÆ#ç·6Æ÷BçF—FÆWÓÂö#ãÇ6ÖÆÃç¶æWrFFR‡6Æ÷Bç7F'G5öB’çFôÆö6ÆU7G&–ær‚—Ò(	2¶æWrFFR‡6Æ÷BæVæG5öB’çFôÆö6ÆUF–ÖU7G&–ær…µÒÂ²†÷W#¢#"ÖF–v—B"ÂÖ–çWFS¢#"ÖF–v—B"Ò—Ò+r·6Æ÷BæÆö6F–öçÓÂ÷6ÖÆÃãÂ÷7ããÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâFVÆWFTf–Æ&–Æ—G’‡6Æ÷Bæ–B—Óå&VÖ÷fSÂö'WGFöããÂö'F–6ÆSâ—×²FFæf–Æ&–Æ—G’æÆVæwF‚bbÇ6ÖÆÃäæò–6·Wv–æF÷w2V&Æ—6†VBãÂ÷6ÖÆÃçÓÂöF—cãÂ÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖS×²&FÖ–â×æVÂFÖ–â×&W6Væ6R×æVÂ"²†FFç&W6Væ6Sòæ—5ööæÆ–æRò"—2ÖöæÆ–æR"¢""—ÓãÄFÖ–ä–6öâæÖSÒ&6öÖ×Væ—G’"óãÇ6Æ74æÖSÒ'fVÇBÖ÷fW&Æ–æR#äÄ•dR$U4Tä4SÂ÷ãÆƒ3ç¶FFç&W6Væ6Sòæ—5ööæÆ–æRò$¶ÆVç6¶’—2öæÆ–æR"¢$¶ÆVç6¶’—2öffÆ–æR'ÓÂöƒ3ãÇåF†RF–6¶W"&VÆ÷rF†Ræf–vF–öâV'2öæÇ’v†–ÆRF†—27v—F6‚—2öæÆ–æRãÂ÷ãÆ–çWBÖ„ÆVæwFƒÒ##"fÇVS×·&W6Væ6Tæ÷FWÒöä6†ævS×²†R’Óâ6WE&W6Væ6Tæ÷FR†RçF&vWBçfÇVR—ÒÆ6V†öÆFW#Ò%6†÷'BÆ—fR7FGW2"óãÆF—cãÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ'fVÇB×7V&Ö—B"öä6Æ–6³×²‚’Óâ6WDV×—&U&W6Væ6R‡G'VR—ÓävòöæÆ–æSÂö'WGFöããÆ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖSÒ&FÖ–â×6V6öæF'’"öä6Æ–6³×²‚’Óâ6WDV×—&U&W6Væ6R†fÇ6R—ÓävòöffÆ–æSÂö'WGFöããÂöF—cãÂ÷6V7F–öãà¢ÂöF—cà¢Ç6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂFÖ–âÖ6öÖ×Væ—G’ÖÖöFW&F–öâ#ãÄFÖ–ä–6öâæÖSÒ&6öÖ×Væ—G’"óãÆƒ3ä6öÖ×Væ—G’ÖöFW&F–öãÂöƒ3ãÇå7VvvW7F–öç2Â&Wf–Ww2æBÆVv7’fVVF&6²6â&R&VÖ÷fVB†W&RâF†—26öçG&öÂ—2&÷FV7FVB'’FÖ–æ—7G&F÷"$Å2ãÂ÷ãÆF—b6Æ74æÖSÒ&FÖ–âÖÆ—7B#à¢¶FFæ6öÖ×Væ—G•7VvvW7F–öç2æÖ‚†—FVÒ’ÓâÆF—b¶W“×²'7VvvW7F–öâÒ"²—FVÒæ–GÓãÇ7ããÆ#å7VvvW7F–öâ+r¶—FVÒçF—FÆWÓÂö#ãÇ6ÖÆÃç¶—FVÒæ&öG—ÓÂ÷6ÖÆÃãÂ÷7ããÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâFVÆWFT6öÖ×Væ—G”VçG'’‚&6öÖ×Væ—G•÷7VvvW7F–öç2"Â—FVÒæ–BÂ%7VvvW7F–öâ"—Óå&VÖ÷fSÂö'WGFöããÂöF—câ—Ð¢¶FFæ6öÖ×Væ—G•&Wf–Ww2æÖ‚†—FVÒ’ÓâÆF—b¶W“×²'&Wf–WrÒ"²—FVÒæ–GÓãÇ7ããÆ#å&Wf–Wr+r¶—FVÒç&F–æwÒóSÂö#ãÇ6ÖÆÃç¶—FVÒæ&öG—ÓÂ÷6ÖÆÃãÂ÷7ããÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâFVÆWFT6öÖ×Væ—G”VçG'’‚&6öÖ×Væ—G•÷&Wf–Ww2"Â—FVÒæ–BÂ%&Wf–Wr"—Óå&VÖ÷fSÂö'WGFöããÂöF—câ—Ð¢¶FFæfVVF&6²æÖ‚†—FVÒ’ÓâÆF—b¶W“×²&fVVF&6²Ò"²—FVÒæ–GÓãÇ7ããÆ#äÆVv7’fVVF&6³Âö#ãÇ6ÖÆÃç¶—FVÒæÖW76vWÓÂ÷6ÖÆÃãÂ÷7ããÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâFVÆWFT6öÖ×Væ—G”VçG'’‚&fVVF&6²"Â—FVÒæ–BÂ$fVVF&6²"—Óå&VÖ÷fSÂö'WGFöããÂöF—câ—Ð¢²FFæ6öÖ×Væ—G•7VvvW7F–öç2æÆVæwF‚bbFFæ6öÖ×Væ—G•&Wf–Ww2æÆVæwF‚bbFFæfVVF&6²æÆVæwF‚bbÇäæò6öÖ×Væ—G’VçG&–W2FòÖöFW&FRãÂ÷çÐ¢ÂöF—cãÂ÷6V7F–öãà¢Â÷6V7F–öãçÐ ¢·F"ÓÓÒ'Æ–W'2"bbÇ6V7F–öâ6Æ74æÖSÒ&FÖ–â×æVÂ#ãÆƒ#åÆ–W"&öÆW3Âöƒ#ãÇäFVÆWFR&VÖ÷fW2F†RÆ–W"&öf–ÆRæBF†V—"V×—&RFFâFÖ–æ—7G&F÷"&öf–ÆW2&R&÷FV7FVBãÂ÷ãÆF—b6Æ74æÖSÒ&FÖ–âÖÆ—7B#à¢¶FFçÆ–W'2æÖ‚†—FVÒ’ÓâÆF—b¶W“×¶—FVÒæ–GÒ6Æ74æÖSÒ&FÖ–â×Æ–W"#ãÇ7ããÆ#ç¶—FVÒæFÖõöæÖRÇÂ—FVÒçW6W&æÖWÓÂö#ãÇ6ÖÆÃç¶—FVÒæFÖõöæÖRòF—66÷&BG¶—FVÒçW6W&æÖWÖ¢&öÆTÆ&VÇ5¶—FVÒç&öÆUÒóò%Æ–W"'×´çVÖ&W"†—FVÒçv–ç2’ÇÂçVÖ&W"†—FVÒæÆ÷76W2’ò+rG¶—FVÒçv–ç7ÕròG¶—FVÒæÆ÷76W7ÔÆ¢"'ÓÂ÷6ÖÆÃãÂ÷7ããÇ6VÆV7BfÇVS×·&öÆW2æ–æ6ÇVFW2†—FVÒç&öÆR’ò—FVÒç&öÆR¢&7W7FöÖW"'Òöä6†ævS×²†R’Óâ6WE&öÆR†—FVÒæ–BÂRçF&vWBçfÇVR—Óç·&öÆW2æÖ‚‡&öÆR’ÓâÆ÷F–öâ¶W“×·&öÆWÒfÇVS×·&öÆWÓç·&öÆTÆ&VÇ5·&öÆU×ÓÂö÷F–öãâ—ÓÂ÷6VÆV7Cç¶—FVÒæ–BÓÒ&öf–ÆRæ–Bbb—FVÒç&öÆRÓÒ&FÖ–â"bbÆ'WGFöâ6Æ74æÖSÒ&FÖ–âÖFVÆWFR×Æ–W""öä6Æ–6³×²‚’ÓâFVÆWFUÆ–W"†—FVÒæ–BÂ—FVÒæFÖõöæÖRÇÂ—FVÒçW6W&æÖR—ÓäFVÆWFRÆ–W#Âö'WGFöãçÓÂöF—câ—Ð¢ÂöF—cãÂ÷6V7F–öãçÐ¢ÂöÖ–ãà¢“°§Ð ¢òòUDbÓ‚6÷W&6R–çFVw&—G’Ö&¶W"à 