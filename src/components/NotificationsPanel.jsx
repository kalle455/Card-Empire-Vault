import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import PurchaseChat from "./PurchaseChat";
import "./NotificationsPanel.css";

export default function NotificationsPanel({ chatOnly = false }) {
  const { profile, session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatLoadError, setChatLoadError] = useState("");
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
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  if (!session) {
    return <main className="notifications-page"><p className="vault-overline">{chatOnly ? "PRIVATE TRADE CHAT" : "LIVE UPDATES"}</p><h1>{chatOnly ? "Purchase chats" : "Notifications"}</h1><div className="notifications-empty">Sign in to receive Card Empire updates and purchase chats.</div></main>;
  }

  const unread = notifications.filter((item) => !item.read).length;
  const isAdmin = profile?.role === "admin";
  const openChats = chats.filter((chat) => chat.status !== "deal_completed");
  const closedChats = chats.filter((chat) => chat.status === "deal_completed");
  const chatRow = (chat, closed = false) => (
    <button className={closed ? "closed-chat-row" : ""} key={chat.id} onClick={() => setActiveChat(chat)}>
      <span><strong>{isAdmin ? chat.buyer?.username ?? "Customer" : "Kalenski™"}</strong><small>{new Date(chat.created_at).toLocaleString()}</small></span>
      <em>{chat.card_summary}</em><b>{closed ? "Deal complete" : "Open ↗"}</b>
    </button>
  );

  return (
    <main className="notifications-page">
      <header>
        <div><p className="vault-overline">{chatOnly ? "PRIVATE TRADE CHAT" : "LIVE UPDATES"}</p><h1>{chatOnly ? isAdmin ? "Customer chats" : "Your purchase chats" : "Notifications"}</h1><p>{chatOnly ? "Open a purchase to chat with " + (isAdmin ? "the customer" : "Kalenski™") + " in real time." : "Offers, events and purchase confirmations arrive here automatically."}</p></div>
        {!chatOnly && unread > 0 && <button onClick={markAllRead}>Mark all read <span>{unread}</span></button>}
      </header>

      {loading ? <p className="notification-loading">Loading updates…</p> : (
        <>
          {!chatOnly && <section className="notification-list">
            {notifications.length ? notifications.map((item) => (
              <article className={item.read ? "read" : "unread"} key={item.id}>
                <span className="notification-dot" />
                <div><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
                <button aria-label="Mark as read" onClick={() => markRead(item.id)}>✓</button>
              </article>
            )) : <div className="notifications-empty">No notifications yet.</div>}
          </section>}

          <section className="purchase-chat-inbox">
            <div className="inbox-section-head"><div><p className="vault-overline">PRIVATE TRADE CHAT</p><h2>{isAdmin ? "Customer chats" : "Your chats with Kalenski™"}</h2></div><span>{openChats.length}</span></div>
            <div className="purchase-chat-list">
              {chatLoadError ? <p className="notifications-empty">{chatLoadError}</p> : openChats.length ? openChats.map((chat) => chatRow(chat)) : <p className="notifications-empty">No active purchase chats.</p>}
            </div>
            {!chatLoadError && closedChats.length > 0 && <section className="closed-chat-section">
              <div className="closed-chat-heading"><p>Closed chats</p><strong>Deal complete · {closedChats.length}</strong></div>
              <div className="purchase-chat-list closed-chat-list">{closedChats.map((chat) => chatRow(chat, true))}</div>
            </section>}
          </section>
        </>
      )}
      {activeChat && <PurchaseChat chat={activeChat} onClose={() => setActiveChat(null)} />}
    </main>
  );
}
