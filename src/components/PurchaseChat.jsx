import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./PurchaseChat.css";

export default function PurchaseChat({ chat, onClose }) {
  const { profile, session } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef(null);
  const isAdmin = profile?.role === "admin";
  const partnerName = isAdmin ? chat?.buyer?.username ?? "Customer" : "Kalenski™";

  useEffect(() => {
    if (!chat?.id || !session) return undefined;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("purchase_chat_messages")
        .select("*, sender:profiles(username)")
        .eq("chat_id", chat.id)
        .order("created_at");

      if (error) setNotice(error.message);
      else setMessages(data ?? []);
    }

    loadMessages();
    const channel = supabase.channel("purchase-chat-" + chat.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "purchase_chat_messages",
        filter: "chat_id=eq." + chat.id,
      }, loadMessages)
      .subscribe();

    return () => channel.unsubscribe();
  }, [chat?.id, session]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !session || sending) return;

    setSending(true);
    const { error } = await supabase.from("purchase_chat_messages").insert({
      chat_id: chat.id,
      sender_id: session.user.id,
      body,
    });
    setSending(false);

    if (error) return setNotice(error.message);
    setText("");
    setNotice("");
  }

  return (
    <aside className="purchase-chat" aria-label={"Live chat with " + partnerName}>
      <header>
        <div>
          <span>● Live chat</span>
          <strong>{partnerName}</strong>
        </div>
        <button aria-label="Close chat" onClick={onClose}>×</button>
      </header>
      <p className="chat-card-summary">{chat?.card_summary}</p>
      <main>
        {messages.map((message) => {
          const mine = message.sender_id === session?.user.id;
          const sender = message.is_system ? "Kalenski™" : mine ? profile?.username ?? "You" : message.sender?.username ?? partnerName;
          return (
            <div className={message.is_system ? "system-message" : mine ? "from-player" : "from-kalenski"} key={message.id}>
              <small>{sender}</small>
              <p>{message.body}</p>
            </div>
          );
        })}
        <span ref={messagesEnd} />
      </main>
      {notice && <p className="chat-notice">{notice}</p>}
      <form onSubmit={send}>
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength="1200" placeholder={"Write to " + partnerName + "…"} />
        <button disabled={sending}>{sending ? "…" : "Send"}</button>
      </form>
    </aside>
  );
}
