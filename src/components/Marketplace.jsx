import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import PurchaseChat from "./PurchaseChat";
import "./Marketplace.css";

const categories = ["All cards", "Monster", "Spell", "Trap"];
const rarities = ["All rarities", "Common", "Rare", "Silver", "Gold", "Rainbow"];

export default function Marketplace() {
  const { profile, session, refreshProfile } = useAuth();
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
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [wishlistIds, setWishlistIds] = useState([]);
  const vaultPageRef = useRef(null);
  const cardSizeFrameRef = useRef(0);
  const initialCardSizeRef = useRef(Math.min(100, Math.max(0, Number(window.localStorage?.getItem("cardstock-card-size") ?? 32))));
  const tiltFrameRef = useRef(0);
  const latestTiltRef = useRef(null);

  const roleKey = String(profile?.role ?? "guest").toLowerCase().replace(/\s+/g, "_");
  const timedVip = Boolean(profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now());
  const isVip = roleKey === "vip" || timedVip;
  const loyaltyCredits = Number(profile?.loyalty_free_card_credits ?? 0);
  const roleLabel = timedVip && roleKey !== "vip"
    ? "V.I.P PASS · 25% active"
    : ({
      vip: "V.I.P · 25% special price",
      potm: "POTM · Player of the Tournament",
      player_of_the_tournament: "POTM · Player of the Tournament",
      regular_customer: "Regular Customer",
      regular: "Regular Customer",
      customer: "Customer",
      admin: "Admin · Market view",
      guest: "Guest · Market price",
    })[roleKey] ?? "Customer";
  const discountedPrice = (card) => Number(card.price) * .75;
  const cardImage = (card) => card?.ygo_card_id
    ? "https://images.ygoprodeck.com/images/cards/" + card.ygo_card_id + ".jpg"
    : card?.image_url;
  async function loadCards() {
    const { data } = await supabase.from("cards").select("*").gt("quantity", 0).order("created_at", { ascending: false });
    setCards(data ?? []);
  }
  async function loadWishlist() {
    if (!session?.user?.id) return setWishlistIds([]);
    const { data } = await supabase.from("wishlists").select("card_id").eq("player_id", session.user.id);
    setWishlistIds((data ?? []).map((item) => item.card_id));
  }
  async function refreshCards() {
    setRefreshing(true);
    await loadCards();
    setRefreshing(false);
  }
  function tiltCase(event) {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    latestTiltRef.current = { target: event.currentTarget, x: event.clientX, y: event.clientY };
    if (tiltFrameRef.current) return;

    tiltFrameRef.current = window.requestAnimationFrame(() => {
      const pending = latestTiltRef.current;
      tiltFrameRef.current = 0;
      if (!pending) return;
      const caseElement = pending.target.querySelector(".collector-case");
      if (!caseElement) return;
      const bounds = pending.target.getBoundingClientRect();
      const x = (pending.x - bounds.left) / bounds.width - .5;
      const y = (pending.y - bounds.top) / bounds.height - .5;
      caseElement.style.setProperty("--case-tilt-x", (-y * 12).toFixed(2) + "deg");
      caseElement.style.setProperty("--case-tilt-y", (x * 12).toFixed(2) + "deg");
    });
  }
  function resetCaseTilt(event) {
    if (tiltFrameRef.current) window.cancelAnimationFrame(tiltFrameRef.current);
    tiltFrameRef.current = 0;
    latestTiltRef.current = null;
    const caseElement = event.currentTarget.querySelector(".collector-case");
    caseElement?.style.removeProperty("--case-tilt-x");
    caseElement?.style.removeProperty("--case-tilt-y");
  }
  function resizeCards(event) {
    const value = Math.min(100, Math.max(0, Number(event.currentTarget.value)));
    if (cardSizeFrameRef.current) window.cancelAnimationFrame(cardSizeFrameRef.current);
    cardSizeFrameRef.current = window.requestAnimationFrame(() => {
      const page = vaultPageRef.current;
      if (!page) return;
      page.style.setProperty("--vault-card-min", (235 + value * .95) + "px");
      page.style.setProperty("--vault-card-height", (420 + value * 1.55) + "px");
      page.style.setProperty("--vault-case-width", (245 + value * .85) + "px");
      window.localStorage?.setItem("cardstock-card-size", String(value));
      cardSizeFrameRef.current = 0;
    });
  }
  useEffect(() => () => {
    if (tiltFrameRef.current) window.cancelAnimationFrame(tiltFrameRef.current);
    if (cardSizeFrameRef.current) window.cancelAnimationFrame(cardSizeFrameRef.current);
  }, []);

  useEffect(() => {
    loadCards();
    const channel = supabase.channel("vault-cards").on("postgres_changes", { event: "*", schema: "public", table: "cards" }, loadCards).subscribe();
    return () => channel.unsubscribe();
  }, []);

  useEffect(() => {
    loadWishlist();
    if (!session?.user?.id) return undefined;
    const channel = supabase.channel("market-wishlist-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlists", filter: "player_id=eq." + session.user.id }, loadWishlist)
      .subscribe();
    return () => channel.unsubscribe();
  }, [session?.user?.id]);

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
  const loyaltyEligibleCard = cart.find((card) => Number(card.price) <= 5000);
  const loyaltyFreeCardId = redeemLoyalty && loyaltyCredits > 0 && loyaltyEligibleCard ? loyaltyEligibleCard.id : null;
  const loyaltyCardValue = loyaltyFreeCardId
    ? (isVip ? discountedPrice(loyaltyEligibleCard) : Number(loyaltyEligibleCard.price))
    : 0;
  const total = subtotal - discount - loyaltyCardValue;

  async function submitOffer(event) {
    event.preventDefault();
    if (!session) return setNotice("Please sign in before making an offer.");
    const { error } = await supabase.from("offers").insert({ player_id: session.user.id, card_name: offerCard.name, amount: Number(offer) });
    if (error) return setNotice(error.message);
    setOfferCard(null); setOffer(""); setNotice("Offer sent to Kalenski™.");
  }
  async function toggleWishlist(card) {
    if (!session) return setNotice("Connect Discord before using the wishlist.");
    const saved = wishlistIds.includes(card.id);
    const result = saved
      ? await supabase.from("wishlists").delete().eq("player_id", session.user.id).eq("card_id", card.id)
      : await supabase.from("wishlists").insert({ player_id: session.user.id, card_id: card.id });
    if (result.error) return setNotice(result.error.message);
    setWishlistIds((current) => saved ? current.filter((id) => id !== card.id) : [...current, card.id]);
    setNotice(saved ? `${card.name} removed from your wishlist.` : `${card.name} is on your wishlist. Discord availability alerts are armed.`);
  }
  async function purchase() {
    if (!session) return setNotice("Please sign in before requesting a purchase.");
    const results = await Promise.all(cart.map((card) => {
      const useCardstockPass = card.id === loyaltyFreeCardId;
      return supabase.rpc("purchase_card", {
        p_card_id: card.id,
        p_quantity: 1,
        p_paid_gold: useCardstockPass ? 0 : isVip ? Number(card.price) * .75 : Number(card.price),
        p_redeem_loyalty: useCardstockPass,
      });
    }));
    const failure = results.find((result) => result.error);
    if (failure) return setNotice(failure.error.message);
    await refreshProfile?.();
    const purchased = [...cart];
    const cardSummary = purchased.map((card) => card.name).join(", ");
    const { data: chatId, error: chatError } = await supabase.rpc("start_purchase_chat", { p_card_summary: cardSummary });
    setCart([]); setCartOpen(false); setRedeemLoyalty(false); loadCards();
    if (chatError) return setNotice("Purchase request received, but the live chat could not be created. Please tell Kalenski™.");
    setActiveChat({ id: chatId, card_summary: cardSummary });
    setNotice("");
  }

  const isOverlayOpen = Boolean(cartOpen || offerCard || selectedCard || activeChat);

  const initialCardSize = initialCardSizeRef.current;
  const vaultSizing = {
    "--vault-card-min": (235 + initialCardSize * .95) + "px",
    "--vault-card-height": (420 + initialCardSize * 1.55) + "px",
    "--vault-case-width": (245 + initialCardSize * .85) + "px",
  };

  return <main ref={vaultPageRef} className={"vault-page" + (isOverlayOpen ? " is-overlay-open" : "")} style={vaultSizing}>
    <header className="vault-header"><div><p className="vault-overline">KALENSKI™ PRIVATE COLLECTION</p><h1>The <em>Cardstock</em></h1><p>Every card is owned, listed and traded directly by Kalenski™.</p></div><div className="vault-header-actions"><button className="vault-refresh" onClick={refreshCards} disabled={refreshing}>{refreshing ? "Updating…" : "↻ Refresh"}</button><button className="vault-cart" onClick={() => setCartOpen(true)}>Cart <span>{cart.length}</span></button></div></header>
    <section className="vault-tools"><label className="vault-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Cardstock" /></label><div className="filter-line">{categories.map((item) => <button key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="filter-line">{rarities.map((item) => <button key={item} className={rarity === item ? "is-active" : ""} onClick={() => setRarity(item)}>{item}</button>)}</div><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Sort: Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option></select><label className="card-size-control"><small>Card size</small><span>−</span><input type="range" min="0" max="100" defaultValue={initialCardSize} onInput={resizeCards} aria-label="Adjust card size" /><b>+</b></label></section>
    <div className="vault-meta"><span>{shownCards.length} cards available</span><span className={"market-role-chip role-" + roleKey}>{isVip ? "VIP PRICE ACTIVE · −25%" : roleLabel}</span>{session && <span className="loyalty-market-chip">✦ {Number(profile?.loyalty_points ?? 0)} Empire Points · {loyaltyCredits} Cardstock Pass{loyaltyCredits === 1 ? "" : "es"}</span>}</div>{notice && <p className="vault-notice">{notice}</p>}
    <section className="vault-grid case-only-grid">{shownCards.length === 0 && <div className="vault-empty"><p className="vault-overline">CARDSTOCK IS READY</p><h2>No cards listed yet.</h2><p>Kalenski™ will add the first cards from the Admin Dashboard.</p></div>}{shownCards.map((card) => <article className={"vault-card case-only-card " + (card.rarity || "common").toLowerCase()} key={card.id}><button className="vault-image" aria-label={"View details for " + card.name} onPointerMove={tiltCase} onPointerLeave={resetCaseTilt} onClick={() => setSelectedCard(card)}><span className="collector-case"><span className="case-label"><span className="case-name"><b>{card.name}</b><small>© KALENSKI™ CARD EMPIRE</small></span><span className="case-grade"><small>CONDITION</small><b>MINT 10</b></span></span><span className="vault-card-art">{cardImage(card) && <img src={cardImage(card)} alt={card.name} decoding="async" loading="lazy" />}</span><span className="case-glass" aria-hidden="true" /><span className="case-plaque">KALENSKI™ CARD EMPIRE</span></span><span className={"case-price-chip" + (isVip ? " is-vip" : "")}><small>{isVip ? "VIP PRICE · 25% OFF" : "MARKET PRICE"}</small><b>{(isVip ? discountedPrice(card) : Number(card.price)).toLocaleString()} G</b>{isVip && <del>{Number(card.price).toLocaleString()} G</del>}</span></button></article>)}</section>
    {selectedCard && <div className="vault-overlay"><article className={"card-detail-modal " + (selectedCard.rarity || "common").toLowerCase()}><button className="detail-close" onClick={() => setSelectedCard(null)}>×</button><div className="detail-image">{selectedCard.image_url && <div className="detail-collector-case"><span className="detail-case-label"><span className="detail-case-name"><b>{selectedCard.name}</b><small>© KALENSKI™ CARD EMPIRE</small></span><span className="detail-case-grade"><small>CONDITION</small><b>MINT 10</b></span></span><span className="detail-card-art"><img src={cardImage(selectedCard)} alt={selectedCard.name} decoding="async" /></span><span className="detail-case-glass" aria-hidden="true" /><span className="detail-case-plaque">KALENSKI™ CARD EMPIRE</span></div>}</div><div className="detail-copy"><p className="vault-overline">{selectedCard.category} · {selectedCard.rarity}</p><h2>{selectedCard.name}</h2><p>{selectedCard.description || "A card from Kalenski™’s private Cardstock."}</p><dl><div><dt>{isVip ? "VIP price" : "Price"}</dt><dd className={isVip ? "detail-vip-price" : ""}>{isVip ? <><b>{discountedPrice(selectedCard).toLocaleString()} G</b><del>{Number(selectedCard.price).toLocaleString()} G</del></> : <>{Number(selectedCard.price).toLocaleString()} G</>}</dd></div><div><dt>Stock</dt><dd>{selectedCard.quantity} available</dd></div></dl><button className="wishlist-button" type="button" onClick={() => toggleWishlist(selectedCard)}><span>{wishlistIds.includes(selectedCard.id) ? "♥" : "♡"}</span>{wishlistIds.includes(selectedCard.id) ? "Saved to wishlist" : "Add to wishlist"}</button><button className="vault-submit" disabled={quantityInCart(selectedCard.id) >= selectedCard.quantity} onClick={() => addToCart(selectedCard)}>{quantityInCart(selectedCard.id) >= selectedCard.quantity ? "Maximum in cart" : "Add to cart"}</button><button className="detail-offer" onClick={() => { setOfferCard(selectedCard); setSelectedCard(null); }}>Make offer</button></div></article></div>}
    {offerCard && <div className="vault-overlay"><form className="vault-modal" onSubmit={submitOffer}><p className="vault-overline">MAKE AN OFFER</p><h2>{offerCard.name}</h2><label>Your offer in Gold<input required value={offer} onChange={(event) => setOffer(event.target.value)} inputMode="numeric" placeholder="e.g. 45000" /></label><textarea placeholder="Message for Kalenski™ (optional)" /><button className="vault-submit">Send offer</button><button type="button" className="vault-cancel" onClick={() => setOfferCard(null)}>Cancel</button></form></div>}
    {cartOpen && <div className="vault-overlay"><aside className="vault-cart-panel"><div className="cart-panel-head"><h2>Your cart</h2><button onClick={() => setCartOpen(false)}>×</button></div><div className="cart-items">{cart.length ? cart.map((card, index) => <div className="cart-line" key={card.id + index}><span>{card.name}</span><strong className={isVip || card.id === loyaltyFreeCardId ? "cart-line-vip" : ""}>{card.id === loyaltyFreeCardId ? <><b>FREE · Cardstock Pass</b><del>{(isVip ? discountedPrice(card) : Number(card.price)).toLocaleString()} G</del></> : isVip ? <><b>{discountedPrice(card).toLocaleString()} G</b><del>{Number(card.price).toLocaleString()} G</del></> : <>{Number(card.price).toLocaleString()} G</>}</strong><button onClick={() => setCart((current) => current.filter((_, i) => i !== index))}>Remove</button></div>) : <p className="cart-empty">Your Cardstock cart is empty.</p>}</div><div className="cart-summary"><span>Subtotal <b>{subtotal.toLocaleString()} G</b></span>{isVip && <span className="cart-vip">VIP discount <b>−{discount.toLocaleString()} G</b></span>}{loyaltyFreeCardId && <span className="cart-vip">Cardstock Pass <b>−{loyaltyCardValue.toLocaleString()} G</b></span>}<strong>Total <b>{total.toLocaleString()} G</b></strong></div>{loyaltyCredits > 0 && loyaltyEligibleCard && <label className="cart-loyalty-toggle"><input type="checkbox" checked={redeemLoyalty} onChange={(event) => setRedeemLoyalty(event.target.checked)} /> Use a Cardstock Pass · {loyaltyEligibleCard.name} is free</label>}<button className="vault-submit" disabled={!cart.length} onClick={purchase}>Request purchase</button><p className="cart-note">In-game Gold only. No real payments.</p></aside></div>}
    {activeChat && <PurchaseChat chat={activeChat} onClose={() => setActiveChat(null)} />}
  </main>;
}
