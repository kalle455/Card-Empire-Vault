import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const roleLabels = {
  vip: "V.I.P",
  potm: "POTM · Player of the Tournament",
  player_of_the_tournament: "POTM · Player of the Tournament",
  regular_customer: "Regular Customer",
  regular: "Regular Customer",
  customer: "Customer",
  admin: "Kalenski · Admin",
};

const loyaltyLevel = (points) => {
  if (points >= 250) return { name: "Vault Legend", next: null, color: "legend" };
  if (points >= 100) return { name: "Empire Elite", next: 250, color: "elite" };
  if (points >= 10) return { name: "Regular Customer", next: 100, color: "regular" };
  return { name: "Vault Initiate", next: 10, color: "initiate" };
};

export default function AccountPanel() {
  const { configured, loading, session, profile, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  if (!configured) return <div className="account-card"><h2>Player account</h2><p>Player accounts will be available shortly.</p></div>;
  if (loading) return <div className="account-card">Loading player account…</div>;
  if (session) {
    const activeRole = String(profile?.role ?? "customer").toLowerCase().replace(/\s+/g, "_");
    const timedVip = Boolean(profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now());
    const loyaltyPoints = Number(profile?.loyalty_points ?? 0);
    const loyaltyPurchases = Number(profile?.loyalty_purchases ?? 0);
    const vaultPasses = Number(profile?.loyalty_free_card_credits ?? 0);
    const loyalty = loyaltyLevel(loyaltyPoints);
    const levelStart = loyaltyPoints >= 250 ? 250 : loyaltyPoints >= 100 ? 100 : loyaltyPoints >= 10 ? 10 : 0;
    const progress = loyalty.next ? Math.min(100, Math.round(((loyaltyPoints - levelStart) / (loyalty.next - levelStart)) * 100)) : 100;
    const displayedRole = timedVip && activeRole !== "vip" ? "V.I.P PASS" : (roleLabels[activeRole] ?? "Customer");
    return (
      <section className="account-card player-identity-card">
        <header className="player-profile-head">
          <p className="overline">PLAYER PROFILE · VERIFIED</p>
          <span className="player-profile-status"><i /> Online</span>
        </header>
        <div className="player-name-record">
          <small>EMPIRE PLAYER</small>
          <h2>{profile?.username ?? "Player"}</h2>
        </div>
        <div className="profile-record">
          <div className="profile-score-record"><small>S / N</small><b>{profile?.wins ?? 0} <i>/</i> {profile?.losses ?? 0}</b></div>
          <div className="profile-role-record"><small>ROLE</small><b className={"role-chip role-" + (timedVip ? "vip" : activeRole)}>{displayedRole}</b></div>
        </div>
        <section className={"loyalty-record loyalty-" + loyalty.color}>
          <header><div><small>EMPIRE LOYALTY</small><b>{loyalty.name}</b></div><strong>LVL {loyaltyPoints} <small>· {loyaltyPoints} PTS</small></strong></header>
          <div className="loyalty-progress"><i style={{ width: progress + "%" }} /></div>
          <footer><span>{loyalty.next ? loyalty.next - loyaltyPoints + " pts to " + (loyalty.next === 10 ? "Regular Customer" : loyalty.next === 100 ? "V.I.P Pass" : "Vault Legend") : "Maximum loyalty level reached"}</span><b>{loyaltyPurchases} purchases · {vaultPasses} Vault Pass{vaultPasses === 1 ? "" : "es"}</b></footer>
          {timedVip && <p>V.I.P Pass active until {new Date(profile.vip_until).toLocaleDateString()} · −25% in the Card Vault</p>}
        </section>
        <button className="button-quiet player-signout" onClick={signOut}>Sign out</button>
      </section>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const { error } = mode === "signin" ? await signIn(username, password) : await signUp(username, password);
    setMessage(error ? error.message : mode === "signin" ? "Signed in." : "Account created. You can sign in now.");
  }

  return <section className="account-card"><p className="overline">CARD EMPIRE PLAYER ACCESS</p><h2>{mode === "signin" ? "Welcome back" : "Create your player account"}</h2><p className="account-subtitle">Only your username is shown in the Empire.</p><form className="account-form" onSubmit={submit}><label>Username<input required minLength="3" maxLength="30" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your DMO name" /></label><label>Password<input required minLength="6" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" /></label><button className="button-primary" type="submit">{mode === "signin" ? "Sign in" : "Create account"}</button></form>{message && <p className="account-message">{message}</p>}<button className="button-quiet" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "New here? Create account" : "I already have an account"}</button></section>;
}
