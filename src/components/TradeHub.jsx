import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./TradeHub.css";

export default function TradeHub() {
  const { session } = useAuth();
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [offeredCards, setOfferedCards] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  const cardImage = (card) => card?.ygo_card_id
    ? "https://images.ygoprodeck.com/images/cards/" + card.ygo_card_id + ".jpg"
    : card?.image_url;

  useEffect(() => {
    let active = true;
    const loadCards = async () => {
      const { data } = await supabase.from("cards").select("id, name, image_url, ygo_card_id, rarity, category, price").gt("quantity", 0).order("price", { ascending: false });
      if (active) setCards(data ?? []);
    };
    loadCards();
    const channel = supabase.channel("trade-hub-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, loadCards)
      .subscribe();
    return () => { active = false; channel.unsubscribe(); };
  }, [session]);

  async function submitTrade(event) {
    event.preventDefault();
    if (!session) return setNotice("Please sign in before creating a Trade Hub offer.");
    if (!selectedCard) return setNotice("Choose a card from Cardstock first.");
    const { error } = await supabase.rpc("create_trade_offer", {
      p_card_id: selectedCard.id,
      p_offered_cards: offeredCards,
      p_message: message,
    });
    if (error) return setNotice(error.message);
    setNotice("Trade offer sent to Kalenski™. You will receive a live notification.");
    setOfferedCards("");
    setMessage("");
    setSelectedCard(null);
  }

  return (
    <main className="trade-hub-page">
      <section className="trade-hub-hero">
        <div className="trade-hub-orbit orbit-one" aria-hidden="true" />
        <div className="trade-hub-orbit orbit-two" aria-hidden="true" />
        <p className="trade-kicker">KALENSKI™ PRIVATE EXCHANGE</p>
        <h1>Trade <em>Hub.</em></h1>
        <p>Choose a card from Cardstock. Tell Kalenski™ what you offer in return. Every exchange stays direct.</p>
        <div className="trade-steps"><span><b>01</b> Choose a card</span><span><b>02</b> Make your offer</span><span><b>03</b> Negotiate live</span></div>
      </section>

      <section className="trade-hub-console">
        <header><div><p className="trade-kicker">THE VAULT IS OPEN</p><h2>What are you<br /><em>trading for?</em></h2></div><span>{cards.length} cards eligible</span></header>
        <div className="trade-card-picker">
          {cards.map((card) => <button type="button" key={card.id} className={"trade-pick-card " + (selectedCard?.id === card.id ? "is-selected" : "")} onClick={() => { setSelectedCard(card); setNotice(""); }}>
            <span className="trade-pick-art">{cardImage(card) && <img src={cardImage(card)} alt="" loading="lazy" />}</span>
            <span><small>{card.rarity} · {card.category}</small><b>{card.name}</b><em>{Number(card.price).toLocaleString()} G</em></span>
          </button>)}
          {!cards.length && <p className="trade-empty">Cardstock has no tradeable cards right now.</p>}
        </div>
      </section>

      <section className="trade-proposal-zone">
        <div className="trade-proposal-intro"><p className="trade-kicker">YOUR PROPOSAL</p><h2>{selectedCard ? <>Trade for<br /><em>{selectedCard.name}.</em></> : <>Choose a card<br /><em>to begin.</em></>}</h2><p>Describe exactly what you offer. Kalenski™ can accept, decline or open a live negotiation.</p></div>
        <form className="trade-proposal-form" onSubmit={submitTrade}>
          <label>Wanted card<input readOnly value={selectedCard?.name ?? "Choose a card above"} /></label>
          <label>What do you offer?<textarea required value={offeredCards} onChange={(event) => setOfferedCards(event.target.value)} placeholder="Example: Jinzo (Gold) + 8,000 G" /></label>
          <label>Message for Kalenski™ <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Condition, rarity, special details …" /></label>
          <button className="trade-send-button" disabled={!selectedCard}><span>Send Trade Hub offer</span><b>↗</b></button>
          {notice && <p className="trade-notice">{notice}</p>}
        </form>
      </section>

    </main>
  );
}
