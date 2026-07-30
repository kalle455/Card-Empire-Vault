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
  const [chatCards, setChatCards] = useState([]);

  const isVip = profile?.role === "vip";
  async function loadCards() {
    const { data } = await supabase.from("cards").select("*").gt("quantity", 0).order("created_at", { ascending: false });
    setCards(data ?? []);
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
    const purchased = [...cart]; setCart([]); setCartOpen(false); setChatCards(purchased); setNotice(""); loadCards();
  }

  return <main className="vault-page">
    <header className="vault-header"><div><p className="vault-overline">KALENSKI™ PRIVATE COLLECTION</p><h1>Card <em>Vault</em></h1><p>Every card is owned, listed and traded directly by Kalenski™.</p></div><button className="vault-cart" onClick={() => setCartOpen(true)}>Cart <span>{cart.length}</span></button></header>
    <section className="vault-tools"><label className="vault-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the vault" /></label><div className="filter-line">{categories.map((item) => <button key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="filter-line">{rarities.map((item) => <button key={item} className={rarity === item ? "is-active" : ""} onClick={() => setRarity(item)}>{item}</button>)}</div><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Sort: Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option></select></section>
    <div className="vault-meta"><span>{shownCards.length} cards available</span>{isVip && <strong>VIP: 25% will be deducted in cart</strong>}</div>{notice && <p className="vault-notice">{notice}</p>}
    <section className="vault-grid">{shownCards.length === 0 && <div className="vault-empty"><p className="vault-overline">THE VAULT IS READY</p><h2>No cards listed yet.</h2><p>Kalenski™ will add the first cards from the Admin Dashboard.</p></div>}{shownCards.map((card) => <article className={"vault-card " + (card.rarity || "common").toLowerCase()} key={card.id}><div className="vault-image">{card.image_url && <img src={card.image_url} alt={card.name} />}<span>{card.rarity}</span></div><div className="vault-card-copy"><p>{card.category} · {card.quantity} in stock</p><h2>{card.name}</h2><div><strong>{Number(card.price).toLocaleString()} G</strong><small>{card.quantity === 1 ? "Last copy" : "Available now"}</small></div><button disabled={quantityInCart(card.id) >= card.quantity} onClick={() => addToCart(card)}>{quantityInCart(card.id) >= card.quantity ? "Maximum in cart" : <>Add to cart <b>+</b></>}</button><button className="offer-button" onClick={() => setOfferCard(card)}>Make offer</button></div></article>)}</section>
    {offerCard && <div className="vault-overlay"><form className="vault-modal" onSubmit={submitOffer}><p className="vault-overline">MAKE AN OFFER</p><h2>{offerCard.name}</h2><label>Your offer in Gold<input required value={offer} onChange={(event) => setOffer(event.target.value)} inputMode="numeric" placeholder="e.g. 45000" /></label><textarea placeholder="Message for Kalenski™ (optional)" /><button className="vault-submit">Send offer</button><button type="button" className="vault-cancel" onClick={() => setOfferCard(null)}>Cancel</button></form></div>}
    {cartOpen && <div className="vault-overlay"><aside className="vault-cart-panel"><div className="cart-panel-head"><h2>Your cart</h2><button onClick={() => setCartOpen(false)}>×</button></div><div className="cart-items">{cart.length ? cart.map((card, index) => <div className="cart-line" key={card.id + index}><span>{card.name}</span><strong>{Number(card.price).toLocaleString()} G</strong><button onClick={() => setCart((current) => current.filter((_, i) => i !== index))}>Remove</button></div>) : <p className="cart-empty">Your vault cart is empty.</p>}</div><div className="cart-summary"><span>Subtotal <b>{subtotal.toLocaleString()} G</b></span>{isVip && <span className="cart-vip">VIP discount <b>−{discount.toLocaleString()} G</b></span>}<strong>Total <b>{total.toLocaleString()} G</b></strong></div><button className="vault-submit" disabled={!cart.length} onClick={purchase}>Request purchase</button><p className="cart-note">In-game Gold only. No real payments.</p></aside></div>}
    {chatCards.length > 0 && <PurchaseChat buyer={profile?.username} cards={chatCards} onClose={() => setChatCards([])} />}
  </main>;
}
