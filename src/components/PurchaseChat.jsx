import { useState } from "react";
import "./PurchaseChat.css";

export default function PurchaseChat({ buyer, cards, onClose }) {
  const [messages, setMessages] = useState([{ id: "welcome", sender: "Kalenski™", text: `Purchase request received for ${cards.map((card) => card.name).join(", ")}. I will confirm the in-game trade with you shortly.` }]);
  const [text, setText] = useState("");
  function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setMessages((current) => [...current, { id: Date.now(), sender: buyer ?? "Customer", text: body }]);
    setText("");
  }
  return <aside className="purchase-chat"><header><div><span>● Online</span><strong>Kalenski™</strong></div><button onClick={onClose}>×</button></header><main>{messages.map((message) => <div className={message.sender === "Kalenski™" ? "from-kalenski" : "from-player"} key={message.id}><small>{message.sender}</small><p>{message.text}</p></div>)}</main><form onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Write to Kalenski™…" /><button>Send</button></form></aside>;
}
