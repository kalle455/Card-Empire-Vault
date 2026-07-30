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
  const [completing, setCompleting] = useState(false);
  const [status, setStatus] = useState(chat?.status ?? "open");
  const messagesEnd = useRef(null);
  const isAdmin = profile?.role === "admin";
  const dealCompleted = status === "deal_completed";
  const partnerName = isAdmin ? chat?.buyer?.username ?? "Customer" : "Kalenski™";

  useEffect(() => {
    setStatus(chat?.status ?? "open");
  }, [chat?.id, chat?.status]);

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
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "purchase_chats",
        filter: "id=eq." + chat.id,
      }, (payload) => setStatus(payload.new.status))
      .subscribe();

    return () => channel.unsubscribe();
  }, [chat?.id, session]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !session || sending || dealCompleted) return;

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

  async function completeDeal() {
    if (!isAdmin || completing || dealCompleted) return;
    setCompleting(true);
    const { error } = await supabase.rpc("complete_purchase_chat", { p_chat_id: chat.id });
    setCompleting(false);

    if (error) return setNotice(error.message);
    setStatus("deal_completed");
    setNotice("Deal marked as completed. This chat is now closed.");
  }

  return (
    <aside className="purchase-chat" aria-label={"Live chat with " + partnerName}>
      <header>
        <div>
          <span className={dealCompleted ? "deal-status complete" : "deal-status"}>{dealCompleted ? "✓ Deal completed" : "● Live chat"}</span>
          <strong>{partnerName}</strong>
        </div>
        <div className="chat-actions">
          {isAdmin && !dealCompleted && <button className="complete-deal" onClick={completeDeal} disabled={completing}>{completing ? "…" : "Deal completed"}</button>}
          <button className="close-chat" aria-label="Close chat" onClick={onClose}>×</button>
        </div>
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
      {dealCompleted ? <p className="chat-closed">This deal is complete. New messages are disabled.</p> : (
        <form onSubmit={send}>
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength="1200" placeholder={"Write to " + partnerName + "…"} />
          <button disabled={sending}>{sending ? "…" : "Send"}</button>
        </form>
      )}
    </aside>
  );
}
