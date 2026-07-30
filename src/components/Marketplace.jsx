import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import PurchaseChat from "./PurchaseChat";
import "./Marketplace.css";

const categories = ["All cards", "Monster", "Spell", "Trap"];
const rarities = ["All rarities", "Common", "Rare", "Gold", "Rainbow"];

export default function Marketplace() {
  const { profile, session } = useAuth();
  const [cards, setCards] = useState([]);
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All cards");
  const [rarity, setRarity] = useState("All rarities");
  const [sort, setSort] = useState("featured");
  const [cartOpen, setCartOpen] = useState(false);
  const [offerCard, setOfferCard] = useState(null);
  const [offer, setOffer] = useState("");
  const [notice, setNotice] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardSize, setCardSize] = useState(25);

  const isVip = profile?.role === "vip";
  const cardImage = (card) => card?.ygo_card_id
    ? "https://images.ygoprodeck.com/images/cards/" + card.ygo_card_id + ".jpg"
    : card?.image_url;
  async function loadCards() {
    const { data } = await supabase.from("cards").select("*").gt("quantity", 0).order("created_at", { ascending: false });
    setCards(data ?? []);
  }
  async function refreshCards() {
    setRefreshing(true);
    await loadCards();
    setRefreshing(false);
  }
  function tiltCase(event) {
    const caseElement = event.currentTarget.querySelector(".collector-case");
    if (!caseElement) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    caseElement.style.setProperty("--case-tilt-x", (-y * 12).toFixed(2) + "deg");
    caseElement.style.setProperty("--case-tilt-y", (x * 12).toFixed(2) + "deg");
  }
  function resetCaseTilt(event) {
    const caseElement = event.currentTarget.querySelector(".collector-case");
    caseElement?.style.removeProperty("--case-tilt-x");
    caseElement?.style.removeProperty("--case-tilt-y");
  }
  useEffect(() => {
    loadCards();
    const channel = supabase.channel("vault-cards").on("postgres_changes", { event: "*", schema: "public", table: "cards" }, loadCards).subscribe();
    return () => channel.unsubscribe();
  }, []);

  const shownCards = useMemo(() => cards
    .filter((card) => card.name.toLowerCase().includes(query.toLowerCase()))
    .filter((card) => category === "All cards" || (card.category ?? "").toLowerCase().includes(category.toLowerCase()))
    .filter((card) => rarity === "All rarities" || card.rarity?.toLowerCase() === rarity.toLowerCase())
    .sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : 0), [cards, query, category, rarity, sort]);

  const quantityInCart = (id) => cart.filter((card) => card.id === id).length;
  const addToCart = (card) => {
    if (quantityInCart(card.id) >= card.quantity) return setNotice(`Only ${card.quantity} copy/copies of ${card.name} are available.`);
    setCart((current) => [...current, card]); setNotice("");
  };
  const subtotal = cart.reduce((sum, card) => sum + Number(card.price), 0);
  const discount = isVip ? subtotal * .25 : 0;
  const total = subtotal - discount;

  async function submitOffer(event) {
    event.preventDefault();
    if (!session) return setNotice("Please sign in before making an offer.");
    const { error } = await supabase.from("offers").insert({ player_id: session.user.id, card_name: offerCard.name, amount: Number(offer) });
    if (error) return setNotice(error.message);
    setOfferCard(null); setOffer(""); setNotice("Offer sent to Kalenski™.");
  }
  async function purchase() {
    if (!session) return setNotice("Please sign in before requesting a purchase.");
    const results = await Promise.all(cart.map((card) => supabase.rpc("purchase_card", { p_card_id: card.id, p_quantity: 1, p_paid_gold: isVip ? Number(card.price) * .75 : Number(card.price) })));
    const failure = results.find((result) => result.error);
    if (failure) return setNotice(failure.error.message);
    const purchased = [...cart];
    const cardSummary = purchased.map((card) => card.name).join(", ");
    const { data: chatId, error: chatError } = await supabase.rpc("start_purchase_chat", { p_card_summary: cardSummary });
    setCart([]); setCartOpen(false); loadCards();
    if (chatError) return setNotice("Purchase request received, but the live chat could not be created. Please tell Kalenski™.");
    setActiveChat({ id: chatId, card_summary: cardSummary });
    setNotice("");
  }

  const isOverlayOpen = Boolean(cartOpen || offerCard || selectedCard || activeChat);

  const vaultSizing = {
    "--vault-card-min": (220 + cardSize * 1.4) + "px",
    "--vault-card-height": (385 + cardSize * 2.8) + "px",
    "--vault-case-width": (230 + cardSize * 1.6) + "px",
  };

  return <main className={"vault-page" + (isOverlayOpen ? " is-overlay-open" : "")} style={vaultSizing}>
    <header className="vault-header"><div><p className="vault-overline">KALENSKI™ PRIVATE COLLECTION</p><h1>Card <em>Vault</em></h1><p>Every card is owned, listed and traded directly by Kalenski™.</p></div><div className="vault-header-actions"><button className="vault-refresh" onClick={refreshCards} disabled={refreshing}>{refreshing ? "Updating…" : "↻ Refresh"}</button><button className="vault-cart" onClick={() => setCartOpen(true)}>Cart <span>{cart.length}</span></button></div></header>
    <section className="vault-tools"><label className="vault-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the vault" /></label><div className="filter-line">{categories.map((item) => <button key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="filter-line">{rarities.map((item) => <button key={item} className={rarity === item ? "is-active" : ""} onClick={() => setRarity(item)}>{item}</button>)}</div><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Sort: Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option></select><label className="card-size-control"><small>Card size</small><span>−</span><input type="range" min="0" max="100" value={cardSize} onChange={(event) => setCardSize(Number(event.target.value))} aria-label="Adjust card size" /><b>+</b></label></section>
    <div className="vault-meta"><span>{shownCards.length} cards available</span>{isVip && <strong>VIP: 25% will be deducted in cart</strong>}</div>{notice && <p className="vault-notice">{notice}</p>}
    <section className="vault-grid case-only-grid">{shownCards.length === 0 && <div className="vault-empty"><p className="vault-overline">THE VAULT IS READY</p><h2>No cards listed yet.</h2><p>Kalenski™ will add the first cards from the Admin Dashboard.</p></div>}{shownCards.map((card) => <article className={"vault-card case-only-card " + (card.rarity || "common").toLowerCase()} key={card.id}><button className="vault-image" aria-label={"View details for " + card.name} onPointerMove={tiltCase} onPointerLeave={resetCaseTilt} onClick={() => setSelectedCard(card)}><span className="collector-case"><span className="case-label"><span className="case-name"><b>{card.name}</b><small>© KALENSKI™ CARD EMPIRE</small></span><span className="case-grade"><small>KALENSKI™</small><b>RATED 10</b></span></span><span className="vault-card-art">{cardImage(card) && <img src={cardImage(card)} alt={card.name} decoding="async" loading="lazy" />}</span><span className="case-glass" aria-hidden="true" /><span className="case-plaque">KALENSKI™ CARD EMPIRE</span></span></button></article>)}</section>
    {selectedCard && <div className="vault-overlay"><article className={"card-detail-modal " + (selectedCard.rarity || "common").toLowerCase()}><button className="detail-close" onClick={() => setSelectedCard(null)}>×</button><div className="detail-image">{selectedCard.image_url && <div className="detail-collector-case"><span className="detail-case-label"><span className="detail-case-name"><b>{selectedCard.name}</b><small>© KALENSKI™ CARD EMPIRE</small></span><span className="detail-case-grade"><small>KALENSKI™</small><b>RATED 10</b></span></span><span className="detail-card-art"><img src={cardImage(selectedCard)} alt={selectedCard.name} decoding="async" /></span><span className="detail-case-glass" aria-hidden="true" /><span className="detail-case-plaque">KALENSKI™ CARD EMPIRE</span></div>}</div><div className="detail-copy"><p className="vault-overline">{selectedCard.category} · {selectedCard.rarity}</p><h2>{selectedCard.name}</h2><p>{selectedCard.description || "A card from Kalenski™’s private Card Vault."}</p><dl><div><dt>Price</dt><dd>{Number(selectedCard.price).toLocaleString()} G</dd></div><div><dt>Stock</dt><dd>{selectedCard.quantity} available</dd></div></dl><button className="vault-submit" disabled={quantityInCart(selectedCard.id) >= selectedCard.quantity} onClick={() => addToCart(selectedCard)}>{quantityInCart(selectedCard.id) >= selectedCard.quantity ? "Maximum in cart" : "Add to cart"}</button><button className="detail-offer" onClick={() => { setOfferCard(selectedCard); setSelectedCard(null); }}>Make offer</button></div></article></div>}
    {offerCard && <div className="vault-overlay"><form className="vault-modal" onSubmit={submitOffer}><p className="vault-overline">MAKE AN OFFER</p><h2>{offerCard.name}</h2><label>Your offer in Gold<input required value={offer} onChange={(event) => setOffer(event.target.value)} inputMode="numeric" placeholder="e.g. 45000" /></label><textarea placeholder="Message for Kalenski™ (optional)" /><button className="vault-submit">Send offer</button><button type="button" className="vault-cancel" onClick={() => setOfferCard(null)}>Cancel</button></form></div>}
    {cartOpen && <div className="vault-overlay"><aside className="vault-cart-panel"><div className="cart-panel-head"><h2>Your cart</h2><button onClick={() => setCartOpen(false)}>×</button></div><div className="cart-items">{cart.length ? cart.map((card, index) => <div className="cart-line" key={card.id + index}><span>{card.name}</span><strong>{Number(card.price).toLocaleString()} G</strong><button onClick={() => setCart((current) => current.filter((_, i) => i !== index))}>Remove</button></div>) : <p className="cart-empty">Your vault cart is empty.</p>}</div><div className="cart-summary"><span>Subtotal <b>{subtotal.toLocaleString()} G</b></span>{isVip && <span className="cart-vip">VIP discount <b>−{discount.toLocaleString()} G</b></span>}<strong>Total <b>{total.toLocaleString()} G</b></strong></div><button className="vault-submit" disabled={!cart.length} onClick={purchase}>Request purchase</button><p className="cart-note">In-game Gold only. No real payments.</p></aside></div>}
    {activeChat && <PurchaseChat chat={activeChat} onClose={() => setActiveChat(null)} />}
  </main>;
}
