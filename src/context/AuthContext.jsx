import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

function hasDiscordIdentity(user) {
  if (!user) return false;
  const provider = user.app_metadata?.provider;
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
  const metadata = user.user_metadata ?? {};
  const metadataLooksDiscord = Boolean(metadata.provider_id) && (
    String(metadata.iss ?? "").toLowerCase().includes("discord")
    || String(metadata.avatar_url ?? metadata.picture ?? "").toLowerCase().includes("discord")
  );

  return provider === "discord"
    || providers.includes("discord")
    || user.identities?.some((identity) => identity.provider === "discord")
    || metadataLooksDiscord;
}

function cleanAuthUrl() {
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState("");

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return;
    }

    let result = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

    if (!result.data && hasDiscordIdentity(user)) {
      const repair = await supabase.rpc("ensure_discord_profile");
      if (!repair.error) {
        result = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      }
    }

    setProfile(result.data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      setLoading(true);
      let { data: { session: current }, error } = await supabase.auth.getSession();

      const code = new URLSearchParams(window.location.search).get("code");
      if (!current && code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        current = exchanged.data?.session ?? null;
        error = exchanged.error;
      }

      if (!current && window.location.hash.includes("access_token=")) {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const restored = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          current = restored.data?.session ?? null;
          error = restored.error;
        }
      }

      if (!active) return;
      setAuthError(error?.message ?? "");
      setSession(current);
      await loadProfile(current?.user);
      setLoading(false);
      if (current) cleanAuthUrl();
    }

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setAuthError(event === "SIGNED_OUT" ? "" : authError);
      loadProfile(next?.user).finally(() => setLoading(false));
      if (next && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) cleanAuthUrl();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithDiscord = () => {
    setAuthError("");
    return supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.origin + "/profile",
        scopes: "identify email",
      },
    });
  };
  const signOut = () => supabase.auth.signOut();
  const discordConnected = useMemo(() => hasDiscordIdentity(session?.user), [session]);

  return <AuthContext.Provider value={{
    session,
    profile,
    loading,
    authError,
    signInWithDiscord,
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
