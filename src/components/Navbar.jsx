import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./Navbar.css";

const links = [
  ["/", "Empire"],
  ["/marketplace", "Card Market"],
  ["/trade-hub", "Trade Hub"],
  ["/events", "Events"],
  ["/feedback", "Feedback"],
  ["/about", "About Kalenski"],
];

export default function Navbar() {
  const { profile, session } = useAuth();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const timedVip = Boolean(profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now());
  const hasVipPrice = profile?.role === "vip" || timedVip;

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, [pathname]);

  useEffect(() => {
    if (!session) {
      setUnread(0);
      return undefined;
    }

    async function loadUnread() {
      const { data } = await supabase.from("notifications").select("id").eq("read", false);
      setUnread(data?.length ?? 0);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") loadUnread();
    }

    loadUnread();
    const refreshTimer = window.setInterval(loadUnread, 8000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const channel = supabase.channel("nav-notifications")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: "player_id=eq." + session.user.id,
      }, loadUnread)
      .subscribe((state) => {
        if (state === "SUBSCRIBED") loadUnread();
      });

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      channel.unsubscribe();
    };
  }, [session]);

  return (
    <header className={"empire-nav" + (pathname === "/" ? " is-home-nav" : "") + (isScrolled ? " is-scrolled" : "")}>
      <NavLink to="/" className="empire-brand"><span>Kalenski™</span><strong>Card Empire®</strong></NavLink>
      <nav>{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
      <div className="nav-account">
        {hasVipPrice && <span className="nav-vip">VIP −25%</span>}
        <NavLink className="notification-bell" to="/messages" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          {unread > 0 && <span className="notification-count">{unread > 9 ? "9+" : unread}</span>}
        </NavLink>
        <NavLink className="chat-bubble" to="/chats" aria-label="Open live chats">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.7 8.7 0 0 1-3.58-.78L4 19.5l1.3-3.72A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" /></svg>
        </NavLink>
        <NavLink to="/profile">{profile?.username ?? "Player Login"}</NavLink>
        {profile?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </div>
    </header>
  );
}
