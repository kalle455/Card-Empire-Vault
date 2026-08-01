import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

function cleanDiscordCallbackUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("discord") && !url.searchParams.has("discord_error")) return;
  url.searchParams.delete("discord");
  url.searchParams.delete("discord_error");
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

function friendlyLoginError(error) {
  const message = error?.message ?? String(error ?? "Discord login failed.");
  return new Error(message);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState("");

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) setAuthError(error.message);
    setProfile(data ?? null);
    return data ?? null;
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      setLoading(true);
      const callback = new URLSearchParams(window.location.search);
      const callbackError = callback.get("discord_error");
      let exchangeError = "";

      if (callback.get("discord") === "connected") {
        try {
          const response = await fetch("/api/discord-session", { method: "POST" });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.access_token || !payload.refresh_token) {
            throw new Error(payload.error ?? "Discord session could not be completed.");
          }
          const restored = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          });
          if (restored.error) throw restored.error;
        } catch (error) {
          exchangeError = error.message;
        }
      }

      const { data: { session: current }, error } = await supabase.auth.getSession();
      if (!active) return;
      setSession(current);
      setAuthError(callbackError ? decodeURIComponent(callbackError) : (exchangeError || error?.message || ""));
      await loadProfile(current?.user);
      if (active) setLoading(false);
      cleanDiscordCallbackUrl();
    }

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === "SIGNED_OUT") setAuthError("");
      loadProfile(next?.user).finally(() => {
        if (active) setLoading(false);
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithDiscord = useCallback(async () => {
    setAuthError("");
    try {
      const { data: { session: current }, error } = await supabase.auth.getSession();
      if (error) throw error;

      const response = await fetch("/api/discord-start", {
        method: "POST",
        headers: current?.access_token ? { Authorization: `Bearer ${current.access_token}` } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Discord login could not be started.");

      window.location.assign(payload.url);
      return { data: null, error: null };
    } catch (error) {
      const friendly = friendlyLoginError(error);
      setAuthError(friendly.message);
      return { data: null, error: friendly };
    }
  }, []);

  const saveDmoName = useCallback(async (value) => {
    const dmoName = String(value ?? "").trim();
    if (dmoName.length < 2 || dmoName.length > 30) {
      return { error: new Error("Your DMO name must contain 2 to 30 characters.") };
    }
    if (!session?.user) return { error: new Error("Your player session is missing.") };

    const { error } = await supabase.from("profiles").update({ dmo_name: dmoName }).eq("id", session.user.id);
    if (!error) await loadProfile(session.user);
    return { error };
  }, [loadProfile, session]);

  const signOut = () => supabase.auth.signOut();
  const discordConnected = useMemo(() => Boolean(profile?.discord_id), [profile]);

  return <AuthContext.Provider value={{
    session,
    profile,
    loading,
    authError,
    signInWithDiscord,
    saveDmoName,
    signOut,
    discordConnected,
    refreshProfile: () => loadProfile(session?.user),
    configured: isSupabaseConfigured,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}


