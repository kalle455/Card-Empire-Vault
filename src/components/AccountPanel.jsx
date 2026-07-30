import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const roleLabels = {
  vip: "V.I.P",
  potm: "Player of the Tournament",
  regular_customer: "Regular Customer",
  customer: "Customer",
  admin: "Admin",
};

export default function AccountPanel() {
  const { configured, loading, session, profile, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [message, setMessage] = useState("");

  if (!configured) {
    return <div className="card account-panel"><h2>Player account</h2><p>Account login will be available as soon as Supabase is connected.</p></div>;
  }
  if (loading) return <div className="card account-panel">Loading player account…</div>;
  if (session) {
    return (
      <div className="card account-panel">
        <h2>{profile?.username ?? "Player"}</h2>
        <p className="role-badge">{roleLabels[profile?.role] ?? "Customer"}</p>
        {profile?.role === "potm" && <p className="potm-badge">★ Player of the Tournament</p>}
        <div className="player-record"><span>Wins: {profile?.wins ?? 0}</span><span>Losses: {profile?.losses ?? 0}</span></div>
        <button className="btn-secondary" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const action = mode === "signin"
      ? signIn(form.email, form.password)
      : signUp(form.email, form.password, form.username);
    const { error } = await action;
    setMessage(error ? error.message : mode === "signin" ? "Signed in." : "Check your email to confirm your account.");
  }

  return (
    <section className="card account-panel">
      <h2>{mode === "signin" ? "Player login" : "Create player account"}</h2>
      <form className="account-form" onSubmit={submit}>
        {mode === "signup" && <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />}
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required minLength="6" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn-primary" type="submit">{mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      {message && <p className="account-message">{message}</p>}
      <button className="text-button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Create a new player account" : "I already have an account"}
      </button>
    </section>
  );
}
