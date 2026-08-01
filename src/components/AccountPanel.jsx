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
  if (points >= 100) return { name: "Vault Legend", next: null, color: "legend" };
  if (points >= 50) return { name: "Empire Elite", next: 100, color: "elite" };
  if (points >= 20) return { name: "Regular Customer", next: 50, color: "regular" };
  if (points >= 10) return { name: "Regular Customer", next: 20, color: "regular" };
  return { name: "Vault Initiate", next: 10, color: "initiate" };
};

function DiscordMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 5.3A16 16 0 0 0 15 4l-.5 1.1a14 14 0 0 0-5 0L9 4a16 16 0 0 0-3.9 1.3C2.6 9 1.9 12.5 2.2 16a16 16 0 0 0 4.9 2.5l1.2-1.6a10 10 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.7 1.7 11.3 0l.6.4c-.6.4-1.3.7-1.9.9l1.2 1.6A16 16 0 0 0 23 16c.4-4.1-.7-7.5-4.1-10.7ZM8.7 14.2c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z" /></svg>;
}

export default function AccountPanel() {
  const { configured, loading, session, profile, signInWithDiscord, saveDmoName, signOut, discordConnected } = useAuth();
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [savingDmo, setSavingDmo] = useState(false);
  const [dmoName, setDmoName] = useState("");

  async function connectDiscord() {
    setMessage("");
    setConnecting(true);
    const { error } = await signInWithDiscord();
    if (error) {
      setMessage(error.message);
      setConnecting(false);
    }
  }

  async function saveDmoIdentity(event) {
    event.preventDefault();
    setMessage("");
    setSavingDmo(true);
    const { error } = await saveDmoName(dmoName);
    if (error) setMessage(error.message);
    setSavingDmo(false);
  }

  if (!configured) return <div className="account-card"><h2>Discord access</h2><p>Player access will be available shortly.</p></div>;
  if (loading) return <div className="account-card">Checking Discord connection…</div>;

  if (!session || !discordConnected) {
    return <section className="account-card discord-access-card">
      <p className="overline">CARD EMPIRE · VERIFIED ACCESS</p>
      <div className="discord-access-mark"><DiscordMark /></div>
      <h2>Continue with Discord</h2>
      <p className="account-subtitle">A connected Discord account is required to enter the Card Market, Trade Hub and private chats. Card Empire uses only your Discord ID and username — never your email, avatar, banner, messages, friends or servers.</p>
      <button className="discord-login-button" type="button" onClick={connectDiscord} disabled={connecting}>
        <DiscordMark /><span>{connecting ? "Connecting…" : "Connect Discord account"}</span>
      </button>
      {session && !discordConnected && <p className="discord-migration-note">Your old player login is no longer accepted. Connect Discord to continue.</p>}
      {message && <p className="account-message">{message}</p>}
    </section>;
  }

  if (session && discordConnected && !profile?.dmo_name) {
    return <section className="account-card discord-access-card dmo-name-card">
      <p className="overline">DISCORD VERIFIED · FINAL PLAYER STEP</p>
      <div className="discord-access-mark"><DiscordMark /></div>
      <h2>Enter your DMO name</h2>
      <p className="account-subtitle">This is the exact name Kalenski will see for you inside DMO. It is stored separately from your Discord username.</p>
      <form onSubmit={saveDmoIdentity}>
        <label htmlFor="dmo-player-name">DMO player name</label>
        <input id="dmo-player-name" value={dmoName} onChange={(event) => setDmoName(event.target.value)} minLength="2" maxLength="30" autoComplete="off" required placeholder="Your name in DMO" />
        <button className="discord-login-button" type="submit" disabled={savingDmo}>
          <span>{savingDmo ? "Saving…" : "Confirm DMO name"}</span>
        </button>
      </form>
      <p className="discord-migration-note">Discord: @{profile?.username ?? "verified"} · No email stored</p>
      {message && <p className="account-message">{message}</p>}
      <button className="button-quiet player-signout" type="button" onClick={signOut}>Use another Discord account</button>
    </section>;
  }

  const activeRole = String(profile?.role ?? "customer").toLowerCase().replace(/\s+/g, "_");
  const timedVip = Boolean(profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now());
  const loyaltyPoints = Number(profile?.loyalty_points ?? 0);
  const loyaltyPurchases = Number(profile?.loyalty_purchases ?? 0);
  const vaultPasses = Number(profile?.loyalty_free_card_credits ?? 0);
  const loyalty = loyaltyLevel(loyaltyPoints);
  const levelStart = loyaltyPoints >= 100 ? 100 : loyaltyPoints >= 50 ? 50 : loyaltyPoints >= 20 ? 20 : loyaltyPoints >= 10 ? 10 : 0;
  const progress = loyalty.next ? Math.min(100, Math.round(((loyaltyPoints - levelStart) / (loyalty.next - levelStart)) * 100)) : 100;
  const displayedRole = timedVip && activeRole !== "vip" ? "V.I.P PASS" : (roleLabels[activeRole] ?? "Customer");

  return (
    <section className="account-card player-identity-card">
      <header className="player-profile-head">
        <p className="overline">PLAYER PROFILE · DISCORD VERIFIED</p>
        <span className="player-profile-status"><i /> Online</span>
      </header>
      <div className="player-name-record">
        <small>DMO PLAYER · DISCORD @{profile?.username ?? "verified"}</small>
        <h2>{profile?.dmo_name ?? "DMO Player"}</h2>
      </div>
      <div className="profile-record">
        <div className="profile-score-record"><small>S / N</small><b>{profile?.wins ?? 0} <i>/</i> {profile?.losses ?? 0}</b></div>
        <div className="profile-role-record"><small>ROLE</small><b className={"role-chip role-" + (timedVip ? "vip" : activeRole)}>{displayedRole}</b></div>
      </div>
      <section className={"loyalty-record loyalty-" + loyalty.color}>
        <header><div><small>EMPIRE LOYALTY</small><b>{loyalty.name}</b></div><strong>LVL {loyaltyPoints} <small>· {loyaltyPoints} PTS</small></strong></header>
        <div className="loyalty-progress"><i style={{ width: progress + "%" }} /></div>
        <footer><span>{loyalty.next ? loyalty.next - loyaltyPoints + " pts to " + (loyalty.next === 10 ? "Regular Customer" : loyalty.next === 20 ? "Vault Pass" : loyalty.next === 50 ? "7-day V.I.P Pass" : "30-day V.I.P Pass") : "Maximum loyalty level reached"}</span><b>{loyaltyPurchases} purchases · {vaultPasses} Vault Pass{vaultPasses === 1 ? "" : "es"}</b></footer>
        {timedVip && <p>V.I.P Pass active until {new Date(profile.vip_until).toLocaleDateString()} · −25% in the Card Vault</p>}
      </section>
      <button className="button-quiet player-signout" onClick={signOut}>Sign out of Discord</button>
    </section>
  );
}
