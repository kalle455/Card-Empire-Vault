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
const roleLabels = { customer: "Customer", regular_customer: "Regular Customer", vip: "V.I.P", potm: "POTM · Player of the Tournament", admin: "Kalenski · Admin" };
const eventFormats = [
  { value: "five_way_ffa", label: "5-WAY FFA", detail: "5 players", capacity: 5 },
  { value: "six_way_ffa", label: "6-WAY FFA", detail: "6 players", capacity: 6 },
  { value: "three_way_ffa", label: "3-WAY FFA", detail: "2v2v2 · 6 players", capacity: 6 },
  { value: "four_way_ffa", label: "4-WAY FFA", detail: "2v2v2v2 · 8 players", capacity: 8 },
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
    return <section className="admin-shell"><p className="vault-overline">RESTRICTED AREA</p><h1>Admin access only.</h1><p>Sign in with Kalenski’s administrator account to manage the Empire.</p></section>;
  }

  const totalGold = data.purchases.reduce((sum, item) => sum + Number(item.paid_gold), 0);
  const cardsSold = data.purchases.reduce((sum, item) => sum + Number(item.quantity), 0);

  async function addCard(e) {
    e.preventDefault();
    if (!selectedCatalogCard) {
      return setNotice("Choose a card from the official DMO catalogue first.");
    }

    setNotice("Getting the automatic card image…");
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
    setNotice(selectedCatalogCard.name + " was added to Cardstock · " + selectedCatalogCard.gameRarity + " rarity.");
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
    setNotice("Reading card names from the screenshot locally in your browser…");

    try {
      const { createWorker, PSM } = await import("tesseract.js");
      let pass = 0;
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") setInventoryScan((current) => ({ ...current, progress: Math.round((pass * .5 + (message.progress ?? 0) * .5) * 100) }));
        },
      });
      let gridResult;
      let fullResult;
      try {
        const titleSheet = await createInventoryTitleSheet(file);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
        gridResult = await worker.recognize(titleSheet);
        pass = 1;
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
        fullResult = await worker.recognize(file);
      } finally {
        await worker.terminate();
      }

      const gridDetected = detectCatalogCards(gridResult?.data?.text);
      const fullDetected = detectCatalogCards(fullResult?.data?.text);
      const mergedDetected = new Map(gridDetected.map((candidate) => [normaliseCardName(candidate.name), candidate]));
      for (const candidate of fullDetected) {
        const key = normaliseCardName(candidate.name);
        if (!mergedDetected.has(key)) mergedDetected.set(key, { ...candidate, quantity: 1 });
      }
      const detected = [...mergedDetected.values()];
      const enriched = await Promise.all(detected.map(async (candidate) => {
        const match = await enrichCatalogCard(candidate);
        const existing = data.cards.find((item) => normaliseCardName(item.name) === normaliseCardName(match.name));
        return {
          ...candidate,
          ...match,
          selected: candidate.confidence >= 78,
          quantity: candidate.quantity ?? 1,
          price: existing?.price ?? "",
          existingId: existing?.id ?? null,
        };
      }));
      setScanCandidates(enriched);
      setInventoryScan((current) => ({ ...current, state: "review", progress: 100 }));
      const totalCopies = enriched.reduce((sum, candidate) => sum + Number(candidate.quantity ?? 1), 0);
      setNotice(enriched.length ? `${enriched.length} different cards and ${totalCopies} total copies detected. Review every row before importing.` : "No safe catalogue match was found. Add cards manually in the review area.");
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
    const approved = scanCandidates.filter((candidate) => candidate.selected && Number(candidate.quantity) > 0);
    if (!approved.length) return setNotice("Approve at least one detected card first.");
    if (approved.some((candidate) => !candidate.existingId && candidate.price === "")) return setNotice("Set your price for every new card before importing.");

    setInventoryScan((current) => ({ ...current, state: "saving" }));
    for (const candidate of approved) {
      const quantity = Math.max(1, Math.floor(Number(candidate.quantity)));
      const result = candidate.existingId
        ? await supabase.from("cards").update({ quantity: Number(data.cards.find((item) => item.id === candidate.existingId)?.quantity ?? 0) + quantity, ...(candidate.price === "" ? {} : { price: Number(candidate.price) }) }).eq("id", candidate.existingId)
        : await supabase.from("cards").insert({ name: candidate.name, price: Number(candidate.price), quantity, category: candidate.category, rarity: candidate.rarity, ygo_card_id: candidate.ygo_card_id ?? null, image_url: candidate.image_url ?? null, description: candidate.description ?? "" });
      if (result.error) {
        setInventoryScan((current) => ({ ...current, state: "review" }));
        return setNotice(`${candidate.name} could not be imported: ${result.error.message}`);
      }
    }

    setScanCandidates([]);
    setInventoryScan((current) => ({ ...current, state: "done" }));
    setNotice(`${approved.length} reviewed card entries were saved to Cardstock.`);
    load();
  }

  async function submitEvent(e) {
    e.preventDefault();
    const payload = {
      title: event.title,
      starts_at: event.starts_at,
      description: event.description,
      banlist_id: null,
      event_format: event.event_format,
    };
    const result = editingEventId
      ? await supabase.from("events").update(payload).eq("id", editingEventId)
      : await supabase.from("events").insert({ ...payload, created_by: profile.id });

    if (result.error) return setNotice(result.error.message);
    setNotice(editingEventId ? "Event updated and players were notified." : "Event created and players were notified.");
    setEvent(blankEvent);
    setEditingEventId(null);
    load();
  }

  function editEvent(item) {
    setEditingEventId(item.id);
    setEvent({
      title: item.title,
      starts_at: toLocalDateTime(item.starts_at),
      description: item.description ?? "",
      event_format: eventFormats.some((format) => format.value === item.event_format) ? item.event_format : "five_way_ffa",
    });
    setNotice("Editing " + item.title + ".");
  }

  async function deleteEvent(id, title) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    setNotice(error ? error.message : title + " was removed.");
    load();
  }

  async function confirmWinner(eventId, eventTitle) {
    const winnerId = winnerSelections[eventId];
    if (!winnerId) return setNotice("Choose a registered player first.");

    const winner = data.players.find((player) => player.id === winnerId);
    const { error } = await supabase.rpc("set_event_winner", {
      p_event_id: eventId,
      p_winner_id: winnerId,
    });

    if (error) return setNotice(error.message);
    setNotice((winner?.username ?? "The selected player") + " won " + eventTitle + " and received +1 win.");
    setWinnerSelections((current) => {
      const next = { ...current };
      delete next[eventId];
      return next;
    });
    load();
  }

  async function deleteCard(id, name) {
    const { error } = await supabase.from("cards").update({ quantity: 0 }).eq("id", id);
    setNotice(error ? error.message : name + " was archived safely. Existing orders and trades remain intact.");
    load();
  }

  async function saveCard(e) {
    e.preventDefault();
    const { error } = await supabase.from("cards").update({
      price: Number(editingCard.price),
      avg_price: editingCard.avg_price === "" || editingCard.avg_price == null ? null : Number(editingCard.avg_price),
      price_status: editingCard.price_status || "unavailable",
      price_source: editingCard.price_status === "available" ? "DMO Marketplace" : null,
      price_updated_at: editingCard.price_status === "available" ? new Date().toISOString() : editingCard.price_updated_at,
      quantity: Number(editingCard.quantity),
      category: editingCard.category,
      rarity: editingCard.rarity,
    }).eq("id", editingCard.id);
    if (error) return setNotice(error.message);
    setNotice(editingCard.name + " was updated.");
    setEditingCard(null);
    load();
  }

  async function setOffer(id, status) {
    const { error } = await supabase.from("offers").update({ status }).eq("id", id);
    setNotice(error ? error.message : "Offer " + status + ".");
    load();
  }

  async function respondToTrade(id, status) {
    const { data: chatId, error } = await supabase.rpc("respond_to_trade_offer", {
      p_offer_id: id,
      p_status: status,
    });
    if (error) return setNotice(error.message);
    setNotice(status === "declined" ? "Trade offer declined." : "Trade chat opened. Taking you to the inbox…");
    load();
    if (chatId) window.setTimeout(() => window.location.assign("/chats"), 450);
  }

  async function setRole(id, role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setNotice(error ? error.message : "Player role updated.");
    load();
  }

  async function deletePlayer(id, username) {
    const { data, error } = await supabase.rpc("delete_player_profile", { p_player_id: id });
    setNotice(error ? error.message : (data ?? username) + " was removed from Card Empire.");
    load();
  }

  async function publishAnnouncement(e) {
    e.preventDefault();
    const { error } = await supabase.from("community_announcements").insert({ title: adminAnnouncement.title.trim(), body: adminAnnouncement.body.trim() });
    if (error) return setNotice(error.message);
    setAdminAnnouncement({ title: "", body: "" });
    setNotice("Announcement published to the Community.");
  }

  async function publishPoll(e) {
    e.preventDefault();
    const labels = adminPoll.options.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 6);
    if (labels.length < 2) return setNotice("A poll needs at least two comma-separated options.");
    const { data: poll, error } = await supabase.from("community_polls").insert({ question: adminPoll.question.trim() }).select().single();
    if (error) return setNotice(error.message);
    const optionResult = await supabase.from("community_poll_options").insert(labels.map((label, position) => ({ poll_id: poll.id, label, position })));
    if (optionResult.error) return setNotice(optionResult.error.message);
    setAdminPoll({ question: "", options: "" });
    setNotice("Community poll opened.");
  }

  async function publishAvailability(e) {
    e.preventDefault();
    if (new Date(availabilityForm.ends_at) <= new Date(availabilityForm.starts_at)) return setNotice("The pickup window must end after it starts.");
    const { error } = await supabase.from("empire_availability").insert({
      title: availabilityForm.title.trim(),
      location: availabilityForm.location.trim(),
      starts_at: new Date(availabilityForm.starts_at).toISOString(),
      ends_at: new Date(availabilityForm.ends_at).toISOString(),
      note: availabilityForm.note.trim(),
      created_by: profile.id,
    });
    if (error) return setNotice(error.message);
    setAvailabilityForm(blankAvailability);
    setNotice("Pickup readiness published live.");
    load();
  }

  async function deleteAvailability(id) {
    const { error } = await supabase.from("empire_availability").delete().eq("id", id);
    setNotice(error ? error.message : "Pickup window removed live.");
    load();
  }

  async function setEmpirePresence(isOnline) {
    const { error } = await supabase.from("empire_presence").upsert({
      singleton: true,
      is_online: isOnline,
      status_note: presenceNote.trim() || "Kalenski is online now.",
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    });
    setNotice(error ? error.message : isOnline ? "The live ticker is now visible." : "Kalenski is offline. The ticker is hidden.");
    if (!error) load();
  }

  async function deleteCommunityEntry(table, id, label) {
    const allowedTables = new Set(["community_suggestions", "community_reviews", "feedback"]);
    if (!allowedTables.has(table)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    setNotice(error ? error.message : label + " removed from the Community.");
    if (!error) load();
  }

  const discountPayload = (form) => ({
    percentage: Number(form.percentage),
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    min_total: Number(form.min_total || 0),
    min_card_count: Number(form.min_card_count || 0),
  });

  async function createAutomaticDiscount(e) {
    e.preventDefault();
    const { error } = await supabase.from("automatic_discounts").insert({ name: discountForm.name.trim(), ...discountPayload(discountForm) });
    if (error) return setNotice(error.message);
    setDiscountForm({ name: "", percentage: "", starts_at: "", ends_at: "", min_total: "0", min_card_count: "0" });
    setNotice("Automatic discount published.");
    load();
  }

  async function createDiscountCode(e) {
    e.preventDefault();
    const { error } = await supabase.from("discount_codes").insert({ code: codeForm.code.trim().toUpperCase(), ...discountPayload(codeForm), max_uses: codeForm.max_uses ? Number(codeForm.max_uses) : null });
    if (error) return setNotice(error.message);
    setCodeForm({ code: "", percentage: "", starts_at: "", ends_at: "", min_total: "0", min_card_count: "0", max_uses: "" });
    setNotice("Discount code created.");
    load();
  }

  async function togglePricingRule(table, id, active) {
    const { error } = await supabase.from(table).update({ active }).eq("id", id);
    setNotice(error ? error.message : active ? "Discount activated." : "Discount paused.");
    if (!error) load();
  }

  async function removePricingRule(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    setNotice(error ? error.message : "Discount removed.");
    if (!error) load();
  }

  async function respondToBundle(id, status) {
    const counter = status === "countered" ? Number(bundleCounters[id]) : null;
    const { data: chatId, error } = await supabase.rpc("respond_to_bundle_offer", { p_offer_id: id, p_status: status, p_counter_total: counter });
    if (error) return setNotice(error.message);
    setNotice(status === "declined" ? "Bundle offer declined." : "Bundle chat opened.");
    load();
    if (chatId) window.setTimeout(() => window.location.assign("/chats"), 400);
  }

  const manualScanMatches = searchOfficialCatalog(scanManualQuery, 8);

  return (
    <main className="admin-shell">
      <header><div><p className="vault-overline">KALENSKI™ CONTROL ROOM</p><h1>Empire Admin</h1></div><span>Live system</span></header>
      <nav className="admin-tabs" aria-label="Admin sections">
        <div className="admin-sidebar-profile">
          <AdminIcon name="players" />
          <span><small>CONTROL ROOM</small><b>Hello, {profile?.dmo_name || profile?.username || "Kalenski"}</b></span>
        </div>
        {[
          ["CARDSTOCK", [
            ["cards", "Cards", data.cards.length + " in stock"],
            ["pricing", "Pricing", data.bundleOffers.filter((entry) => entry.status === "pending").length + " bundles"],
          ]],
          ["ORDERS", [
            ["books", "Buy Orders", data.purchases.length + " recorded"],
            ["offers", "Offers", data.offers.filter((entry) => entry.status === "pending").length + " pending"],
            ["trades", "Trade Orders", data.trades.filter((entry) => entry.status === "pending").length + " pending"],
          ]],
          ["EMPIRE", [
            ["events", "Events", data.events.length + " events"],
            ["community", "Community", "Team channel"],
            ["players", "Players", data.players.length + " profiles"],
          ]],
        ].map(([group, items]) => (
          <div className="admin-sidebar-group" key={group}>
            <p>{group}</p>
            {items.map(([item, label, detail]) => (
              <button key={item} className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>
                <AdminIcon name={item} /><span><b>{label}</b><small>{detail}</small></span><i aria-hidden="true">›</i>
              </button>
            ))}
          </div>
        ))}
      </nav>
      {notice && <p className="admin-notice">{notice}</p>}

      {tab === "cards" && <section className="admin-grid">
        <form className="admin-panel" onSubmit={addCard}>
          <h2>Add a card</h2><p>Only cards from the official DMO catalogue can enter Cardstock. Their type and rarity are locked to the game list.</p>
          <div className="card-name-field">
            <input required autoComplete="off" placeholder="Search the official card catalogue (e.g. PO)" value={card.name} onChange={(e) => { setCard({ ...card, name: e.target.value }); setSelectedCatalogCard(null); }} />
            {(suggestions.length > 0 || catalogLoading) && <div className="card-suggestions">{catalogLoading && !suggestions.length && <p className="card-suggestion-loading">Finding official card artwork…</p>}{suggestions.map((item) => (
              <button type="button" key={item.name} onClick={() => { setCard({ ...card, name: item.name, category: item.category, rarity: item.rarity }); setSelectedCatalogCard(item); setSuggestions([]); }}>
                <img src={item.image_url_small || item.image_url || "/kalenski-card-back.svg"} alt="" loading="lazy" />
                <span>{item.name}<small>{item.category} · {item.gameRarity}</small></span><b>{item.gameRarity}</b>
              </button>
            ))}</div>}
          </div>
          <div className="admin-row"><input required type="number" min="0" placeholder="Price in Gold" value={card.price} onChange={(e) => setCard({ ...card, price: e.target.value })} /><input required type="number" min="0" placeholder="Quantity" value={card.quantity} onChange={(e) => setCard({ ...card, quantity: e.target.value })} /></div>
          <div className="admin-row"><input readOnly value={selectedCatalogCard ? selectedCatalogCard.category.toUpperCase() + " · official type" : "Official type"} /><input readOnly value={selectedCatalogCard ? selectedCatalogCard.gameRarity + " · official rarity" : "Official rarity"} /></div>
          <button className="vault-submit" disabled={!selectedCatalogCard}>{selectedCatalogCard ? "Add to Cardstock" : "Choose official card"}</button>
        </form>
        <section className="admin-panel"><header className="admin-cardstock-heading"><div><h2>Cardstock inventory</h2><p>DMO averages are shown only when a verified source value exists.</p></div><label>Market data<select value={marketPriceFilter} onChange={(event) => setMarketPriceFilter(event.target.value)}><option value="all">All cards</option><option value="available">Available</option><option value="unavailable">No market data</option><option value="needs_review">Needs review</option></select></label></header><div className="admin-list">
          {data.cards.filter((item) => marketPriceFilter === "all" || (item.price_status ?? "unavailable") === marketPriceFilter).map((item) => editingCard?.id === item.id ? (
            <form key={item.id} className="admin-card-edit" onSubmit={saveCard}>
              <strong>{item.name}</strong>
              <div className="admin-row"><label>My price<input type="number" min="0" value={editingCard.price} onChange={(e) => setEditingCard({ ...editingCard, price: e.target.value })} /></label><label>Stock<input type="number" min="0" value={editingCard.quantity} onChange={(e) => setEditingCard({ ...editingCard, quantity: e.target.value })} /></label></div>
              <div className="admin-row"><label>AVG DMO price<input type="number" min="0" placeholder="No market data" value={editingCard.avg_price ?? ""} onChange={(e) => setEditingCard({ ...editingCard, avg_price: e.target.value })} /></label><label>Data status<select value={editingCard.price_status ?? "unavailable"} onChange={(e) => setEditingCard({ ...editingCard, price_status: e.target.value })}><option value="available">Available</option><option value="unavailable">No market data</option><option value="needs_review">Needs review</option></select></label></div>
              <a className="admin-market-source" href="https://dmo-market.onrender.com/" target="_blank" rel="noreferrer">Verify against DMO Market ↗</a>
              <div className="admin-row"><select value={editingCard.category} onChange={(e) => setEditingCard({ ...editingCard, category: e.target.value })}><option value="monster">Monster</option><option value="spell">Spell</option><option value="trap">Trap</option></select><select value={editingCard.rarity} onChange={(e) => setEditingCard({ ...editingCard, rarity: e.target.value })}><option value="common">Common</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="rainbow">Rainbow</option></select></div>
              <aside><button type="submit">Save</button><button type="button" onClick={() => setEditingCard(null)}>Cancel</button></aside>
            </form>
          ) : (
            <div key={item.id} className="admin-stock"><span>{item.name}<small className={`market-data-state state-${item.price_status ?? "unavailable"}`}>{item.price_status === "available" && item.avg_price != null ? `AVG ${Number(item.avg_price).toLocaleString()} G` : item.price_status === "needs_review" ? "Market data needs review" : "No market data"}</small></span><b>{item.quantity} · {Number(item.price).toLocaleString()} G</b><aside><button onClick={() => setEditingCard(item)}>Edit</button><button onClick={() => deleteCard(item.id, item.name)}>Archive</button></aside></div>
          ))}
          {!data.cards.length && <p>No database cards yet.</p>}
        </div></section>
        <section className="admin-panel inventory-scanner">
          <header className="inventory-scanner-heading"><div><AdminIcon name="cards" /><p className="vault-overline">SCREENSHOT INVENTORY</p><h2>Detect multiple cards.</h2><p>Upload one screenshot. Card Empire reads it locally, matches only the official DMO catalogue and waits for your approval before saving anything.</p></div><label className="inventory-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={scanInventoryScreenshot} /><span>{inventoryScan.state === "reading" ? `Reading… ${inventoryScan.progress}%` : "Choose screenshot"}</span></label></header>
          {inventoryScan.preview && <div className="inventory-scan-workspace"><figure><img src={inventoryScan.preview} alt="Inventory screenshot preview" /><figcaption>{inventoryScan.filename}</figcaption></figure><div className="inventory-review"><label className="inventory-manual-search">Add a missed card<input value={scanManualQuery} onChange={(event) => setScanManualQuery(event.target.value)} placeholder="Search official DMO catalogue" /></label>{manualScanMatches.length > 0 && <div className="inventory-manual-results">{manualScanMatches.map((match) => <button key={match.name} type="button" onClick={() => addManualScanCandidate(match)}>{match.name}<small>{match.gameRarity}</small></button>)}</div>}
            <div className="inventory-candidate-list">{scanCandidates.map((candidate, index) => <article className={candidate.selected ? "is-approved" : "needs-review"} key={candidate.name}><label className="inventory-approve"><input type="checkbox" checked={candidate.selected} onChange={(event) => updateScanCandidate(index, { selected: event.target.checked })} /><span>{candidate.selected ? "Approved" : "Review"}</span></label><span className="inventory-candidate-art">{(candidate.image_url_small || candidate.image_url) && <img src={candidate.image_url_small || candidate.image_url} alt="" />}</span><div><strong>{candidate.name}</strong><small>{candidate.gameRarity} · {candidate.category}{candidate.existingId ? " · already in Cardstock" : ""}</small><em>{candidate.confidence == null ? "Added manually" : `${candidate.confidence}% OCR confidence`}</em></div><label>Qty<input type="number" min="1" value={candidate.quantity} onChange={(event) => updateScanCandidate(index, { quantity: event.target.value })} /></label><label>My price<input type="number" min="0" value={candidate.price} placeholder={candidate.existingId ? "Keep current" : "Required"} onChange={(event) => updateScanCandidate(index, { price: event.target.value })} /></label><button type="button" className="inventory-remove-candidate" onClick={() => setScanCandidates((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></article>)}{inventoryScan.state === "review" && !scanCandidates.length && <p className="inventory-scan-empty">No automatic match. Use the official catalogue search above to build the review list manually.</p>}</div>
            {scanCandidates.length > 0 && <footer><span>{scanCandidates.filter((candidate) => candidate.selected).length} approved · nothing is saved before confirmation</span><button type="button" className="vault-submit" disabled={inventoryScan.state === "saving"} onClick={importScanCandidates}>{inventoryScan.state === "saving" ? "Saving reviewed cards…" : "Confirm reviewed inventory"}</button></footer>}
          </div></div>}
        </section>
      </section>}

      {tab === "events" && <section className="admin-events">
        <div className="admin-grid">
          <form className="admin-panel" onSubmit={submitEvent}>
            <h2>{editingEventId ? "Edit event" : "Create event"}</h2>
            <input required placeholder="Event name" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} />
            <input required type="datetime-local" value={event.starts_at} onChange={(e) => setEvent({ ...event, starts_at: e.target.value })} />
            <select value={event.event_format} onChange={(e) => setEvent({ ...event, event_format: e.target.value })}>
              {eventFormats.map((format) => <option value={format.value} key={format.value}>{format.label} · {format.detail}</option>)}
            </select>
            <p className="event-rule-note"><b>Official rule:</b> The current in-game banlist is always used unless the event description explicitly says otherwise.</p>
            <textarea placeholder="Rules, location, prize…" value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })} />
            <button className="vault-submit">{editingEventId ? "Save event" : "Publish event"}</button>
            {editingEventId && <button type="button" className="admin-secondary" onClick={() => { setEditingEventId(null); setEvent(blankEvent); }}>Cancel edit</button>}
          </form>

          <section className="admin-panel admin-event-standard"><AdminIcon name="events" /><p className="vault-overline">GLOBAL EVENT STANDARD</p><h2>One current rule set.</h2><p>Every event follows the current in-game banlist by default. Put a clearly written exception into the event description only when an event truly needs one.</p></section>
        </div>

        <section className="admin-panel"><h2>Scheduled events</h2><div className="admin-list">
          {data.events.map((item) => {
            const registrations = item.registrations ?? [];
            const eventFormat = getEventFormat(item.event_format);
            const selectedWinnerId = winnerSelections[item.id] ?? "";
            const winner = data.players.find((player) => player.id === item.winner_id);

            return <div key={item.id} className="admin-event-row">
              <span>
                <b>{item.title}</b>
                <small>{new Date(item.starts_at).toLocaleString()} · {eventFormat.label} · {eventFormat.detail} · {registrations.length}{eventFormat.capacity ? " / " + eventFormat.capacity : ""} registered · Current in-game banlist</small>
                {winner && <em className="event-winner-badge">WINNER · {winner.username} · +1 WIN</em>}
              </span>
              {!winner && <div className="event-winner-controls">
                <select value={selectedWinnerId} onChange={(event) => setWinnerSelections((current) => ({ ...current, [item.id]: event.target.value }))}>
                  <option value="">Choose winner</option>
                  {registrations.map((registration) => <option key={registration.player_id} value={registration.player_id}>{registration.player?.username ?? "Player"}</option>)}
                </select>
                <button disabled={!selectedWinnerId} onClick={() => confirmWinner(item.id, item.title)}>Confirm winner</button>
              </div>}
              <aside><button onClick={() => editEvent(item)}>Edit</button><button onClick={() => deleteEvent(item.id, item.title)}>Remove</button></aside>
            </div>;
          })}
          {!data.events.length && <p>No events scheduled yet.</p>}
        </div></section>
      </section>}

      {tab === "offers" && <section className="admin-panel"><h2>Offers</h2><div className="admin-list">
        {data.offers.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b> offered {Number(item.amount).toLocaleString()} G for {item.card_name}</span><em>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => setOffer(item.id, "accepted")}>Accept</button><button onClick={() => setOffer(item.id, "rejected")}>Decline</button></aside>}</div>)}
        {!data.offers.length && <p>No offers yet.</p>}
      </div></section>}

      {tab === "trades" && <section className="admin-panel admin-order-panel"><header className="admin-order-heading"><div><p className="vault-overline">EXCHANGE DESK</p><h2>Trade Orders</h2></div><span>{data.trades.filter((entry) => entry.status === "pending").length} awaiting action</span></header><p>Players choose a Cardstock card and propose what they offer in return. Accepting or negotiating opens the private live chat.</p><div className="admin-list">
        {data.trades.map((item) => <div key={item.id} className="admin-offer"><span><b>{item.player?.username ?? "Player"}</b> wants <strong>{item.card?.name ?? item.card_name_snapshot ?? "Removed Cardstock card"}</strong><br /><small>Offers: {item.offered_cards}</small>{item.message && <small>Message: {item.message}</small>}</span><em>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => respondToTrade(item.id, "accepted")}>Accept + chat</button><button onClick={() => respondToTrade(item.id, "negotiating")}>Negotiate + chat</button><button onClick={() => respondToTrade(item.id, "declined")}>Decline</button></aside>}{item.chat_id && <aside><button onClick={() => window.location.assign("/chats")}>Open chat</button></aside>}</div>)}
        {!data.trades.length && <p>No Trade Hub offers yet.</p>}
      </div></section>}

      {tab === "pricing" && <section className="admin-pricing-console">
        <header className="admin-order-heading"><div><p className="vault-overline">PRICE CONTROL</p><h2>Discounts & bundle offers</h2></div><span>Server verified</span></header>
        <div className="admin-grid admin-pricing-forms">
          <form className="admin-panel" onSubmit={createAutomaticDiscount}>
            <AdminIcon name="pricing" /><h3>Automatic discount</h3><p>Applies automatically when the active time and minimum order rules match.</p>
            <div className="admin-row"><input required maxLength="80" placeholder="Campaign name" value={discountForm.name} onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })} /><input required type="number" min="0.01" max="90" step="0.01" placeholder="Discount %" value={discountForm.percentage} onChange={(e) => setDiscountForm({ ...discountForm, percentage: e.target.value })} /></div>
            <div className="admin-row"><label>Starts<input type="datetime-local" value={discountForm.starts_at} onChange={(e) => setDiscountForm({ ...discountForm, starts_at: e.target.value })} /></label><label>Ends<input type="datetime-local" value={discountForm.ends_at} onChange={(e) => setDiscountForm({ ...discountForm, ends_at: e.target.value })} /></label></div>
            <div className="admin-row"><input type="number" min="0" placeholder="Minimum total" value={discountForm.min_total} onChange={(e) => setDiscountForm({ ...discountForm, min_total: e.target.value })} /><input type="number" min="0" placeholder="Minimum card count" value={discountForm.min_card_count} onChange={(e) => setDiscountForm({ ...discountForm, min_card_count: e.target.value })} /></div>
            <button className="vault-submit">Publish automatic discount</button>
          </form>
          <form className="admin-panel" onSubmit={createDiscountCode}>
            <AdminIcon name="offers" /><h3>Discount code</h3><p>Create a private checkout code with its own limits and active period.</p>
            <div className="admin-row"><input required minLength="3" maxLength="32" placeholder="CODE" value={codeForm.code} onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} /><input required type="number" min="0.01" max="90" step="0.01" placeholder="Discount %" value={codeForm.percentage} onChange={(e) => setCodeForm({ ...codeForm, percentage: e.target.value })} /></div>
            <div className="admin-row"><label>Starts<input type="datetime-local" value={codeForm.starts_at} onChange={(e) => setCodeForm({ ...codeForm, starts_at: e.target.value })} /></label><label>Ends<input type="datetime-local" value={codeForm.ends_at} onChange={(e) => setCodeForm({ ...codeForm, ends_at: e.target.value })} /></label></div>
            <div className="admin-row"><input type="number" min="0" placeholder="Minimum total" value={codeForm.min_total} onChange={(e) => setCodeForm({ ...codeForm, min_total: e.target.value })} /><input type="number" min="0" placeholder="Minimum cards" value={codeForm.min_card_count} onChange={(e) => setCodeForm({ ...codeForm, min_card_count: e.target.value })} /><input type="number" min="1" placeholder="Max uses" value={codeForm.max_uses} onChange={(e) => setCodeForm({ ...codeForm, max_uses: e.target.value })} /></div>
            <button className="vault-submit">Create discount code</button>
          </form>
        </div>

        <div className="admin-grid admin-pricing-lists">
          <section className="admin-panel"><h3>Automatic campaigns</h3><div className="admin-list">
            {data.automaticDiscounts.map((item) => <div className="admin-pricing-rule" key={item.id}><span><b>{item.name} · {Number(item.percentage)}%</b><small>{item.min_card_count ? `${item.min_card_count}+ cards` : "Any card count"} · {Number(item.min_total).toLocaleString()} G minimum</small></span><em className={item.active ? "is-active" : "is-paused"}>{item.active ? "Active" : "Paused"}</em><aside><button onClick={() => togglePricingRule("automatic_discounts", item.id, !item.active)}>{item.active ? "Pause" : "Activate"}</button><button onClick={() => removePricingRule("automatic_discounts", item.id)}>Remove</button></aside></div>)}
            {!data.automaticDiscounts.length && <p>No automatic discounts configured.</p>}
          </div></section>
          <section className="admin-panel"><h3>Checkout codes</h3><div className="admin-list">
            {data.discountCodes.map((item) => <div className="admin-pricing-rule" key={item.id}><span><b>{item.code} · {Number(item.percentage)}%</b><small>{item.use_count}{item.max_uses ? ` / ${item.max_uses}` : ""} uses · {item.min_card_count ? `${item.min_card_count}+ cards` : "No card minimum"}</small></span><em className={item.active ? "is-active" : "is-paused"}>{item.active ? "Active" : "Paused"}</em><aside><button onClick={() => togglePricingRule("discount_codes", item.id, !item.active)}>{item.active ? "Pause" : "Activate"}</button><button onClick={() => removePricingRule("discount_codes", item.id)}>Remove</button></aside></div>)}
            {!data.discountCodes.length && <p>No discount codes configured.</p>}
          </div></section>
        </div>

        <section className="admin-panel admin-bundle-orders"><header className="admin-order-heading"><div><p className="vault-overline">3+ CARD ORDERS</p><h3>Bundle offers</h3></div><span>{data.bundleOffers.filter((entry) => entry.status === "pending").length} pending</span></header><div className="admin-list">
          {data.bundleOffers.map((item) => <article className="admin-bundle-offer" key={item.id}><span><b>{item.buyer?.dmo_name || item.buyer?.username || "Player"}</b><small>{item.card_summary}</small><small>Listed {Number(item.listed_total).toLocaleString()} G · proposes <strong>{Number(item.proposed_total).toLocaleString()} G</strong>{item.counter_total != null ? ` · counter ${Number(item.counter_total).toLocaleString()} G` : ""}</small></span><em className={`bundle-status status-${item.status}`}>{item.status}</em>{item.status === "pending" && <aside><button onClick={() => respondToBundle(item.id, "accepted")}>Accept + chat</button><label><input type="number" min="0" placeholder="Counter total" value={bundleCounters[item.id] ?? ""} onChange={(e) => setBundleCounters((current) => ({ ...current, [item.id]: e.target.value }))} /><button disabled={!bundleCounters[item.id]} onClick={() => respondToBundle(item.id, "countered")}>Counter + chat</button></label><button onClick={() => respondToBundle(item.id, "declined")}>Decline</button></aside>}{item.chat_id && <button onClick={() => window.location.assign("/chats")}>Open chat</button>}</article>)}
          {!data.bundleOffers.length && <p>No bundle proposals yet.</p>}
        </div></section>
      </section>}

      {tab === "books" && <section className="admin-books admin-order-panel">
        <div className="sales-summary"><article><small>Total Gold</small><strong>{totalGold.toLocaleString()} G</strong></article><article><small>Cards sold</small><strong>{cardsSold}</strong></article><article><small>Purchases</small><strong>{data.purchases.length}</strong></article></div>
        <section className="admin-panel"><header className="admin-order-heading"><div><p className="vault-overline">SALES LEDGER</p><h2>Buy Orders</h2></div><span>{data.purchases.length} recorded</span></header><p>Every completed purchase is saved here with buyer, card, price and time.</p><div className="admin-list">
          {data.purchases.map((item) => <div key={item.id} className="admin-sale"><span><b>{item.card?.name ?? item.card_name ?? "Removed card"}</b><small>Buyer: {item.player?.username ?? "Player"} · {item.quantity} copy/copies</small></span><span><b>{Number(item.paid_gold).toLocaleString()} G</b><small>{new Date(item.created_at).toLocaleString()}</small></span></div>)}
          {!data.purchases.length && <p>No purchases have been recorded yet.</p>}
        </div></section>
      </section>}

      {tab === "community" && <section className="admin-community-console">
        <header><div><p className="vault-overline">CARD EMPIRE TEAM CHANNEL</p><h2>Speak directly to the community.</h2></div><button type="button" onClick={() => window.location.assign("/community")}>View public Community ↗</button></header>
        <div className="admin-grid">
          <form className="admin-panel" onSubmit={publishAnnouncement}><AdminIcon name="community" /><h3>New announcement</h3><p>Send an official message to every verified player.</p><input required value={adminAnnouncement.title} onChange={(e) => setAdminAnnouncement({ ...adminAnnouncement, title: e.target.value })} placeholder="Announcement title" /><textarea required value={adminAnnouncement.body} onChange={(e) => setAdminAnnouncement({ ...adminAnnouncement, body: e.target.value })} placeholder="Message to every player" /><button className="vault-submit">Publish announcement</button></form>
          <form className="admin-panel" onSubmit={publishPoll}><AdminIcon name="offers" /><h3>New community poll</h3><p>Separate each answer with a comma. Up to six options are supported.</p><input required value={adminPoll.question} onChange={(e) => setAdminPoll({ ...adminPoll, question: e.target.value })} placeholder="Community question" /><input required value={adminPoll.options} onChange={(e) => setAdminPoll({ ...adminPoll, options: e.target.value })} placeholder="Option one, Option two, Option three" /><button className="vault-submit">Open poll</button></form>
          <form className="admin-panel admin-availability-panel" onSubmit={publishAvailability}><AdminIcon name="events" /><h3>Pickup readiness</h3><p>Publish when you are online and when customers can collect their cards.</p><div className="admin-row"><input required value={availabilityForm.title} onChange={(e) => setAvailabilityForm({ ...availabilityForm, title: e.target.value })} placeholder="Card pickup" /><input required value={availabilityForm.location} onChange={(e) => setAvailabilityForm({ ...availabilityForm, location: e.target.value })} placeholder="Location / server" /></div><div className="admin-row"><label>Online from<input required type="datetime-local" value={availabilityForm.starts_at} onChange={(e) => setAvailabilityForm({ ...availabilityForm, starts_at: e.target.value })} /></label><label>Online until<input required type="datetime-local" value={availabilityForm.ends_at} onChange={(e) => setAvailabilityForm({ ...availabilityForm, ends_at: e.target.value })} /></label></div><textarea value={availabilityForm.note} maxLength="600" onChange={(e) => setAvailabilityForm({ ...availabilityForm, note: e.target.value })} placeholder="Optional pickup note" /><button className="vault-submit">Publish live window</button></form>
          <section className="admin-panel admin-availability-list"><AdminIcon name="community" /><h3>Published windows</h3><p>These times update immediately for every verified player.</p><div>{data.availability.map((slot) => <article key={slot.id}><span><b>{slot.title}</b><small>{new Date(slot.starts_at).toLocaleString()} – {new Date(slot.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {slot.location}</small></span><button type="button" onClick={() => deleteAvailability(slot.id)}>Remove</button></article>)}{!data.availability.length && <small>No pickup windows published.</small>}</div></section>
          <section className={"admin-panel admin-presence-panel" + (data.presence?.is_online ? " is-online" : "")}><AdminIcon name="community" /><p className="vault-overline">LIVE PRESENCE</p><h3>{data.presence?.is_online ? "Kalenski is online" : "Kalenski is offline"}</h3><p>The ticker below the navigation appears only while this switch is online.</p><input maxLength="120" value={presenceNote} onChange={(e) => setPresenceNote(e.target.value)} placeholder="Short live status" /><div><button type="button" className="vault-submit" onClick={() => setEmpirePresence(true)}>Go online</button><button type="button" className="admin-secondary" onClick={() => setEmpirePresence(false)}>Go offline</button></div></section>
        </div>
        <section className="admin-panel admin-community-moderation"><AdminIcon name="community" /><h3>Community moderation</h3><p>Suggestions, reviews and legacy feedback can be removed here. This control is protected by administrator RLS.</p><div className="admin-list">
          {data.communitySuggestions.map((item) => <div key={"suggestion-" + item.id}><span><b>Suggestion · {item.title}</b><small>{item.body}</small></span><button type="button" onClick={() => deleteCommunityEntry("community_suggestions", item.id, "Suggestion")}>Remove</button></div>)}
          {data.communityReviews.map((item) => <div key={"review-" + item.id}><span><b>Review · {item.rating}/5</b><small>{item.body}</small></span><button type="button" onClick={() => deleteCommunityEntry("community_reviews", item.id, "Review")}>Remove</button></div>)}
          {data.feedback.map((item) => <div key={"feedback-" + item.id}><span><b>Legacy feedback</b><small>{item.message}</small></span><button type="button" onClick={() => deleteCommunityEntry("feedback", item.id, "Feedback")}>Remove</button></div>)}
          {!data.communitySuggestions.length && !data.communityReviews.length && !data.feedback.length && <p>No Community entries to moderate.</p>}
        </div></section>
      </section>}

      {tab === "players" && <section className="admin-panel"><h2>Player roles</h2><p>Delete removes the player profile and their Empire data. Administrator profiles are protected.</p><div className="admin-list">
        {data.players.map((item) => <div key={item.id} className="admin-player"><span><b>{item.dmo_name || item.username}</b><small>{item.dmo_name ? `Discord @${item.username}` : roleLabels[item.role] ?? "Player"}{Number(item.wins) || Number(item.losses) ? ` · ${item.wins}W / ${item.losses}L` : ""}</small></span><select value={roles.includes(item.role) ? item.role : "customer"} onChange={(e) => setRole(item.id, e.target.value)}>{roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select>{item.id !== profile.id && item.role !== "admin" && <button className="admin-delete-player" onClick={() => deletePlayer(item.id, item.dmo_name || item.username)}>Delete player</button>}</div>)}
      </div></section>}
    </main>
  );
}

// UTF-8 source integrity marker.
