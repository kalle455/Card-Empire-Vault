import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import PurchaseChat from "./PurchaseChat";
import "./NotificationsPanel.css";

export default function NotificationsPanel() {
  const { profile, session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
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
        supabase.from("purchase_chats").select("*, buyer:profiles(username)").order("created_at", { ascending: false }),
      ]);
      setNotifications(notificationResult.data ?? []);
      setChats(chatResult.data ?? []);
      setLoading(false);
    }

    load();
    const channel = supabase.channel("player-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "player_id=eq." + session.user.id }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_chats" }, load)
      .subscribe();

    return () => channel.unsubscribe();
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
    return <main className="notifications-page"><p className="vault-overline">LIVE UPDATES</p><h1>Notifications</h1><div className="notifications-empty">Sign in to receive Card Empire updates and purchase chats.</div></main>;
  }

  const unread = notifications.filter((item) => !item.read).length;
  const isAdmin = profile?.role === "admin";

  return (
    <main className="notifications-page">
      <header>
        <div><p className="vault-overline">LIVE UPDATES</p><h1>Notifications</h1><p>Offers, events and purchase confirmations arrive here automatically.</p></div>
        {unread > 0 && <button onClick={markAllRead}>Mark all read <span>{unread}</span></button>}
      </header>

      {loading ? <p className="notification-loading">Loading updates…</p> : (
        <>
          <section className="notification-list">
            {notifications.length ? notifications.map((item) => (
              <article className={item.read ? "read" : "unread"} key={item.id}>
                <span className="notification-dot" />
                <div><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
                <button aria-label="Mark as read" onClick={() => markRead(item.id)}>✓</button>
              </article>
            )) : <div className="notifications-empty">No notifications yet.</div>}
          </section>

          <section className="purchase-chat-inbox">
            <div className="inbox-section-head"><div><p className="vault-overline">PRIVATE TRADE CHAT</p><h2>{isAdmin ? "Customer chats" : "Your chats with Kalenski™"}</h2></div><span>{chats.length}</span></div>
            <div className="purchase-chat-list">
              {chats.length ? chats.map((chat) => (
                <button key={chat.id} onClick={() => setActiveChat(chat)}>
                  <span><strong>{isAdmin ? chat.buyer?.username ?? "Customer" : "Kalenski™"}</strong><small>{new Date(chat.created_at).toLocaleString()}</small></span>
                  <em>{chat.card_summary}</em><b>Open ↗</b>
                </button>
              )) : <p className="notifications-empty">Your purchase chats will appear here.</p>}
            </div>
          </section>
        </>
      )}
      {activeChat && <PurchaseChat chat={activeChat} onClose={() => setActiveChat(null)} />}
    </main>
  );
}
