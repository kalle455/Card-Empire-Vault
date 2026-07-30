import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const links = [
  ["/", "Empire"],
  ["/marketplace", "Card Market"],
  ["/events", "Events"],
  ["/news", "News"],
  ["/feedback", "Feedback"],
  ["/messages", "Updates"],
  ["/about", "About Kalenski"],
];

export default function Navbar() {
  const { profile } = useAuth();
  return (
    <header className="empire-nav">
      <NavLink to="/" className="empire-brand"><span>Kalenski™</span><strong>Card Empire®</strong></NavLink>
      <nav>{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
      <div className="nav-account">
        {profile?.role === "vip" && <span className="nav-vip">VIP −25%</span>}
        <NavLink to="/profile">{profile?.username ?? "Player Login"}</NavLink>
        {profile?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </div>
    </header>
  );
}
