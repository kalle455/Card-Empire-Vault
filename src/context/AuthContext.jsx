import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);
const accountEmail = (username) => `${username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")}@players.cardempire.local`;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    async function loadProfile(user) {
      if (!user) return setProfile(null);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data ?? null);
    }
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current); loadProfile(current?.user).finally(() => setLoading(false));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); loadProfile(next?.user); setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = (username, password) => supabase.auth.signInWithPassword({ email: accountEmail(username), password });
  const signUp = (username, password) => supabase.auth.signUp({ email: accountEmail(username), password, options: { data: { username } } });
  const signOut = () => supabase.auth.signOut();

  return <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, configured: isSupabaseConfigured }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
