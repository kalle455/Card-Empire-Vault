import { useState } from "react";
import ChatWindow from "./chat/ChatWindow";
import cards from "../data/cards";
import { useAuth } from "../context/AuthContext";
import "./Marketplace.css";

export default function Marketplace() {
  const { profile } = useAuth();
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [conversation, setConversation] = useState({ messages: [] });

  const isVip = profile?.role === "vip";
  const subtotal = cart.reduce((sum, card) => sum + card.price, 0);
  const vipDiscount = isVip ? subtotal * 0.25 : 0;
  const total = subtotal - vipDiscount;

  function addToCart(card) {
    setCart((previous) => [...previous, card]);
  }

  function removeFromCart(id) {
    setCart((previous) => previous.filter((card) => card.id !== id));
  }

  function checkout() {
    setConversation({
      messages: [{
        id: Date.now().toString(),
        sender: "Kalenski™",
        text: "Thank you very much for your order. I'll be in touch shortly to finalize the details with you.",
        ts: new Date().toISOString(),
      }],
    });
    setCartOpen(false);
    setOrderOpen(true);
  }

  function sendMessage(message) {
    setConversation((previous) => ({ messages: [...previous.messages, message] }));
  }

  return (
    <div className="marketplace-page">
      <div className="marketplace-header">
        <div>
          <h1 className="title">Marketplace</h1>
          {isVip && <p className="vip-notice">V.I.P active — 25% is deducted in your cart.</p>}
        </div>
        <button className="btn-primary" onClick={() => setCartOpen(true)}>
          🛒 Cart ({cart.length})
        </button>
      </div>

      <div className="card-grid">
        {cards.map((card) => (
          <div className="market-card" key={card.id}>
            <div className="card-image">
              <img src={card.image} alt={card.name} />
            </div>
            <div className="market-card-info">
              <h3>{card.name}</h3>
              <p>{card.type}</p>
              <p>{card.rarity}</p>
              <p>Condition: {card.condition}</p>
              <p className="price">{card.price} G</p>
              <button className="btn-primary" onClick={() => addToCart(card)}>Add to Cart</button>
            </div>
          </div>
        ))}
      </div>

      {cartOpen && (
        <div className="modal-overlay">
          <div className="offer-modal card">
            <h2>Your Cart</h2>
            {cart.length === 0 && <p>Your cart is empty.</p>}
            {cart.map((card) => (
              <div className="cart-row" key={card.id}>
                <span>{card.name}</span>
                <span>
                  {card.price} G <button className="cart-remove" aria-label={"Remove " + card.name} onClick={() => removeFromCart(card.id)}>✕</button>
                </span>
              </div>
            ))}
            <hr />
            <div className="cart-total"><span>Subtotal</span><strong>{subtotal.toFixed(2)} G</strong></div>
            {isVip && (
              <div className="cart-total vip-discount">
                <span>V.I.P discount (25%)</span><strong>−{vipDiscount.toFixed(2)} G</strong>
              </div>
            )}
            <div className="cart-total grand-total"><span>Total</span><strong>{total.toFixed(2)} G</strong></div>
            <button className="btn-primary" disabled={cart.length === 0} onClick={checkout}>Checkout</button>
            <button className="btn-secondary" onClick={() => setCartOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {orderOpen && (
        <ChatWindow
          currentUser={{ id: profile?.id ?? "Buyer" }}
          card={{ name: cart.length + " Card Order" }}
          conversation={conversation}
          onSend={sendMessage}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  );
}
