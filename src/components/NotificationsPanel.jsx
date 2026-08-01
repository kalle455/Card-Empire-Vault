import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import PurchaseChat from "./PurchaseChat";
import "./NotificationsPanel.css";

function notificationMeta(message = "") {
  const value = message.toLowerCase();
  if (value.includes("offer")) return { type: "offer", label: "OFFER", icon: "◇" };
  if (value.includes("event") || value.includes("tournament")) return { type: "event", label: "EVENT", icon: "⚔" };
  if (value.includes("registration")) return { type: "registration", label: "REGISTRATION", icon: "✓" };
  if (value.includes("purchase") || value.includes("deal")) return { type: "purchase", label: "DEAL", icon: "◆" };
  if (value.includes("chat") || value.includes("message")) return { type: "chat", label: "CHAT", icon: "◌" };
  return { type: "system", label: "EMPIRE", icon: "✦" };
}

export default function NotificationsPanel({ chatOnly = false }) {
  const { profile, session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatLoadError, setChatLoadError] = useState("");
  const [panelNotice, setPanelNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      setChats([]);
      setLoading(false);
      return undefined;
    }

    async function load() {
      const [notificationResult, chatResult] = await Promise.all([
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
        supabase.rpc("list_purchase_chats"),
      ]);
      setNotifications(notificationResult.data ?? []);
      setChats((chatResult.data ?? []).map((chat) => ({ ...chat, buyer: { username: chat.buyer_username } })));
      setChatLoadError(chatResult.error?.message ?? "");
      setLoading(false);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") load();
    }

    load();
    const refreshTimer = window.setInterval(load, 8000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const channel = supabase.channel("player-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "player_id=eq." + session.user.id }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_chats" }, load)
      .subscribe((state) => {
        if (state === "SUBSCRIBED") load();
      });

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      channel.unsubscribe();
    };
  }, [session]);

  async function markAllRead() {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
    if (error) return setPanelNotice(error.message);
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
  }

  async function markRead(id) {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) return setPanelNotice(error.message);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  async function deleteNotification(id) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return setPanelNotice(error.message);
    setNotifications((items) => items.filter((item) => item.id !== id));
    setPanelNotice("");
  }

  async function deleteReadNotifications() {
    const { error } = await supabase.from("notifications").delete().eq("read", true);
    if (error) return setPanelNotice(error.message);
    setNotifications((items) => items.filter((item) => !item.read));
    setPanelNotice("");
  }

  if (!session) {
    return <main className="notifications-page"><p className="vault-overline">{chatOnly ? "PRIVATE TRADE CHAT" : "LIVE UPDATES"}</p><h1>{chatOnly ? "Live chats" : "Notifications"}</h1><div className="notifications-empty">Connect Discord to receive Card Empire updates and private chats.</div></main>;
  }

  const unread = notifications.filter((item) => !item.read).length;
  const readCount = notifications.length - unread;
  const isAdmin = profile?.role === "admin";
  const openChats = chats.filter((chat) => chat.status !== "deal_completed");
  const closedChats = chats.filter((chat) => chat.status === "deal_completed");
  const chatRow = (chat, closed = false) => (
    <button className={"chat-inbox-row" + (closed ? " closed-chat-row" : "")} key={chat.id} onClick={() => setActiveChat(chat)}>
      <span className="chat-row-identity"><i>{closed ? "✓" : "●"}</i><span><strong>{isAdmin ? chat.buyer?.username ?? "Customer" : "Kalenski™"}</strong><small>{new Date(chat.created_at).toLocaleString()}</small></span></span>
      <em>{chat.card_summary}</em>
      <b><small>{closed ? "ARCHIVED" : "LIVE"}</small><span>{closed ? "Deal complete" : "Open ↗"}</span></b>
    </button>
  );

  return (
    <main className="notifications-page">
      <header className="notifications-hero">
        <div><p className="vault-overline">{chatOnly ? "PRIVATE TRADE CHAT" : "LIVE UPDATES"}</p><h1>{chatOnly ? isAdmin ? "Customer chats" : "Your purchase chats" : "Notifications"}</h1><p>{chatOnly ? "Open a purchase or Trade Hub request to chat with " + (isAdmin ? "the customer" : "Kalenski™") + " in real time." : "Offers, events, purchases and registrations arrive here automatically."}</p></div>
        {!chatOnly && <div className="notification-header-actions">
          {unread > 0 && <button onClick={markAllRead}>Mark all read <span>{unread}</span></button>}
          {readCount > 0 && <button className="delete-read-button" onClick={deleteReadNotifications}>Delete read</button>}
        </div>}
      </header>

      {panelNotice && <p className="notification-panel-notice">{panelNotice}</p>}
      {loading ? <p className="notification-loading">Loading updates…</p> : (
        <>
          {!chatOnly && <section className="notification-list">
            {notifications.length ? notifications.map((item) => {
              const meta = notificationMeta(item.message);
              return <article className={(item.read ? "read" : "unread") + " notification-" + meta.type} key={item.id}>
                <span className="notification-symbol" aria-hidden="true">{meta.icon}</span>
                <div className="notification-copy"><small className="notification-kind">{meta.label}</small><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div>
                <div className="notification-actions">
                  {!item.read && <button className="read-notification" aria-label="Mark as read" title="Mark as read" onClick={() => markRead(item.id)}>✓</button>}
                  <button className="delete-notification" aria-label="Delete notification" title="Delete notification" onClick={() => deleteNotification(item.id)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg>
                  </button>
                </div>
              </article>;
            }) : <div className="notifications-empty">No notifications yet.</div>}
          </section>}

          <section className="purchase-chat-inbox">
            <div className="inbox-section-head"><div><p className="vault-overline">PRIVATE TRADE CHAT</p><h2>{isAdmin ? "Customer chats" : "Your chats with Kalenski™"}</h2></div><span>{openChats.length}</span></div>
            <div className="purchase-chat-list">
              {chatLoadError ? <p className="notifications-empty">{chatLoadError}</p> : openChats.length ? openChats.map((chat) => chatRow(chat)) : <p className="notifications-empty">No active chats.</p>}
            </div>
            {!chatLoadError && closedChats.length > 0 && <section className="closed-chat-section">
              <div className="closed-chat-heading"><div><p>DEAL ARCHIVE</p><span>Completed conversations remain available as a permanent record.</span></div><strong><i>✓</i> {closedChats.length} complete</strong></div>
              <div className="purchase-chat-list closed-chat-list">{closedChats.map((chat) => chatRow(chat, true))}</div>
            </section>}
          </section>
        </>
      )}
      {activeChat && <PurchaseChat chat={activeChat} onClose={() => setActiveChat(null)} />}
    </main>
  );
}

