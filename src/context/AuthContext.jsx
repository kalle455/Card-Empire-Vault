import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

function hasDiscordIdentity(user) {
  if (!user) return false;
  const provider = user.app_metadata?.provider;
  const providers = user.app_metadata?.providers ?? [];
  return provider === "discord"
    || providers.includes("discord")
    || user.identities?.some((identity) => identity.provider === "discord");
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      loadProfile(current?.user).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      loadProfile(next?.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithDiscord = () => supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: window.location.origin + "/profile",
      scopes: "identify email",
    },
  });
  const signOut = () => supabase.auth.signOut();
  const discordConnected = useMemo(() => hasDiscordIdentity(session?.user), [session]);

  return <AuthContext.Provider value={{
    session,
    profile,
    loading,
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
