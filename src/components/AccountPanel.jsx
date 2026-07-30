import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const roleLabels = { vip: "V.I.P", potm: "Player of the Tournament", trusted_trader: "Trusted Trader", regular_customer: "Regular Customer", customer: "Customer", admin: "Kalenski — Admin" };

export default function AccountPanel() {
  const { configured, loading, session, profile, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  if (!configured) return <div className="account-card"><h2>Player account</h2><p>Player accounts will be available shortly.</p></div>;
  if (loading) return <div className="account-card">Loading player account…</div>;
  if (session) return <section className="account-card"><p className="overline">PLAYER PROFILE</p><h2>{profile?.username ?? "Player"}</h2><span className="role-chip">{roleLabels[profile?.role] ?? "Customer"}</span>{profile?.role === "potm" && <p className="potm-mark">✦ Player of the Tournament</p>}<div className="record"><span><b>{profile?.wins ?? 0}</b> Wins</span><span><b>{profile?.losses ?? 0}</b> Losses</span></div><button className="button-quiet" onClick={signOut}>Sign out</button></section>;

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const { error } = mode === "signin" ? await signIn(username, password) : await signUp(username, password);
    setMessage(error ? error.message : mode === "signin" ? "Signed in." : "Account created. You can sign in now.");
  }

  return <section className="account-card"><p className="overline">CARD EMPIRE PLAYER ACCESS</p><h2>{mode === "signin" ? "Welcome back" : "Create your player account"}</h2><p className="account-subtitle">Only your username is shown in the Empire.</p><form className="account-form" onSubmit={submit}><label>Username<input required minLength="3" maxLength="30" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your DMO name" /></label><label>Password<input required minLength="6" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" /></label><button className="button-primary" type="submit">{mode === "signin" ? "Sign in" : "Create account"}</button></form>{message && <p className="account-message">{message}</p>}<button className="button-quiet" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "New here? Create account" : "I already have an account"}</button></section>;
}
