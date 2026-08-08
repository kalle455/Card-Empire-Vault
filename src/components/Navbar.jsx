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
  ["/community", "Community"],
  ["/about", "About Kalenski"],
];

export default function Navbar() {
  const { profile, session, discordConnected } = useAuth();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [presence, setPresence] = useState(null);
  const timedVip = Boolean(profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now());
  const hasVipPrice = profile?.role === "vip" || timedVip;

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
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

  useEffect(() => {
    let active = true;
    async function loadPresence() {
      const { data } = await supabase.from("empire_presence").select("is_online,status_note,updated_at").eq("singleton", true).maybeSingle();
      if (active) setPresence(data?.is_online ? data : null);
    }
    loadPresence();
    const channel = supabase.channel("nav-empire-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "empire_presence" }, loadPresence)
      .subscribe();
    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, []);

  return (
    <><header className={"empire-nav" + (pathname === "/" ? " is-home-nav" : "") + (isScrolled ? " is-scrolled" : "") + (mobileOpen ? " mobile-open" : "")}>
      <div className="brand-partner-cluster">
        <NavLink to="/" className="empire-brand" aria-label="Kalenski Card Empire home">
          <img src="/card-empire-wordmark.svg" alt="Kalenski Card Empire" />
        </NavLink>
        <NavLink to="/partners" className="partners-nav-link" aria-label="Partners"><small>Partners</small></NavLink>
      </div>
      <nav id="empire-primary-navigation" aria-label="Primary navigation">
        {links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        <NavLink to="/partners" className="mobile-partners-link">Partners</NavLink>
        <div className="mobile-menu-account">
          <NavLink to="/profile">{discordConnected ? profile?.username ?? "Discord Player" : "Discord Login"}</NavLink>
          {profile?.role === "admin" && <NavLink to="/admin">Admin Control</NavLink>}
        </div>
      </nav>
      <div className="nav-account">
        {hasVipPrice && <span className="nav-vip">VIP −25%</span>}
        {discordConnected && <NavLink className="notification-bell" to="/messages" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          {unread > 0 && <span className="notification-count">{unread > 9 ? "9+" : unread}</span>}
        </NavLink>}
        {discordConnected && <NavLink className="chat-bubble" to="/chats" aria-label="Open live chats">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5.5h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-5.5 3v-3a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" /><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" /></svg>
        </NavLink>}
        <NavLink to="/profile">{discordConnected ? profile?.username ?? "Discord Player" : "Discord Login"}</NavLink>
        {profile?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </div>
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-controls="empire-primary-navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span />
        <span />
      </button>
    </header>{presence && <aside className="empire-presence-ticker" role="status" aria-label={`Kalenski is online. ${presence.status_note}`}><div className="empire-presence-track"><div className="empire-presence-copy"><span><i /> KALENSKI IS ONLINE</span><p>{presence.status_note}</p><NavLink to="/community">View pickup calendar <b>↗</b></NavLink></div><div className="empire-presence-copy" aria-hidden="true"><span><i /> KALENSKI IS ONLINE</span><p>{presence.status_note}</p><NavLink to="/community" tabIndex="-1">View pickup calendar <b>↗</b></NavLink></div></div></aside>}</>
  );
}
