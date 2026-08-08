import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./PurchaseChat.css";
import "./PurchaseChatPinned.css";
import "./PurchaseChatOutcomes.css";

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
  const dealFailed = status === "deal_failed";
  const dealClosed = dealCompleted || dealFailed;
  const partnerName = isAdmin ? chat?.buyer?.username ?? "Customer" : "Kalenski™";

  useEffect(() => {
    let active = true;
    setStatus(chat?.status ?? "open");
    setNotice("");
    setText("");

    async function loadCurrentStatus() {
      const { data } = await supabase.rpc("list_purchase_chats");
      const storedChat = data?.find((item) => item.id === chat?.id);
      if (active && storedChat) setStatus(storedChat.status);
    }

    if (chat?.id && session) loadCurrentStatus();
    return () => { active = false; };
  }, [chat?.id, chat?.status, session]);

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
    if (!body || !session || sending || dealClosed) return;

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
    if (!isAdmin || completing || dealClosed) return;
    setCompleting(true);
    const { error } = await supabase.rpc("complete_purchase_chat", { p_chat_id: chat.id });
    setCompleting(false);

    if (error) return setNotice(error.message);
    setStatus("deal_completed");
    setNotice("");
  }

  async function failDeal() {
    if (!isAdmin || completing || dealClosed) return;
    setCompleting(true);
    const { error } = await supabase.rpc("fail_purchase_chat", { p_chat_id: chat.id });
    setCompleting(false);

    if (error) return setNotice(error.message);
    setStatus("deal_failed");
    setNotice("");
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <aside className={"purchase-chat" + (dealCompleted ? " is-closed-chat" : "") + (dealFailed ? " is-failed-chat" : "")} aria-label={"Live chat with " + partnerName}>
      <header>
        <div>
          <span className={dealCompleted ? "deal-status complete" : dealFailed ? "deal-status failed" : "deal-status"}>{dealCompleted ? "✓ Deal completed" : dealFailed ? "× Deal failed" : "● Active deal"}</span>
          <strong>{partnerName}</strong>
        </div>
        <div className="chat-actions">
          {isAdmin && !dealClosed && <><button className="complete-deal" onClick={completeDeal} disabled={completing}>{completing ? "…" : "Complete"}</button><button className="fail-deal" onClick={failDeal} disabled={completing}>Failed</button></>}
          <button className="close-chat" aria-label="Close chat" onClick={onClose}>×</button>
        </div>
      </header>
      <p className="chat-card-summary">{chat?.card_summary}</p>
      <main>
        {messages.map((message) => {
          const mine = message.sender_id === session?.user.id;
          const sender = message.is_system ? "Kalenski™" : mine ? profile?.username ?? "You" : message.sender?.username ?? partnerName;
          return (
            <div className={message.is_system ? "system-message" + (message.body.startsWith("Thank you for your order") ? " order-welcome" : "") : mine ? "from-player" : "from-kalenski"} key={message.id}>
              <small>{sender}</small>
              <p>{message.body}</p>
            </div>
          );
        })}
        <span ref={messagesEnd} />
      </main>
      {notice && <p className="chat-notice">{notice}</p>}
      {dealClosed ? <section className="chat-closed"><span>{dealFailed ? "×" : "✓"}</span><div><strong>{dealFailed ? "Deal failed" : "Deal complete"}</strong><p>{dealFailed ? "This deal did not go through. The conversation remains in the archive." : "This conversation is sealed in the Deal Archive. New messages are disabled."}</p></div></section> : (
        <form onSubmit={send}>
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength="1200" placeholder={"Write to " + partnerName + "…"} />
          <button disabled={sending}>{sending ? "…" : "Send"}</button>
        </form>
      )}
    </aside>,
    document.body,
  );
}
