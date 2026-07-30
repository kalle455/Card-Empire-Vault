import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./NotificationsPanel.css";

export default function NotificationsPanel() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { setLoading(false); return undefined; }
    async function load() {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
      setNotifications(data ?? []);
      setLoading(false);
    }
    load();
    const channel = supabase.channel("player-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "player_id=eq." + session.user.id }, load)
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
    return <main className="notifications-page"><p className="vault-overline">LIVE UPDATES</p><h1>Notifications</h1><div className="notifications-empty">Sign in to receive Card Empire updates.</div></main>;
  }

  const unread = notifications.filter((item) => !item.read).length;
  return (
    <main className="notifications-page">
      <header>
        <div><p className="vault-overline">LIVE UPDATES</p><h1>Notifications</h1><p>Offers, events and purchase confirmations arrive here automatically.</p></div>
        {unread > 0 && <button onClick={markAllRead}>Mark all read <span>{unread}</span></button>}
      </header>
      {loading ? <p className="notification-loading">Loading updates…</p> : (
        <section className="notification-list">
          {notifications.length ? notifications.map((item) => (
            <article className={item.read ? "read" : "unread"} key={item.id}>
              <span className="notification-dot" />
              <div><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
              <button onClick={() => markRead(item.id)}>✓</button>
            </article>
          )) : <div className="notifications-empty">No notifications yet.</div>}
        </section>
      )}
    </main>
  );
}
