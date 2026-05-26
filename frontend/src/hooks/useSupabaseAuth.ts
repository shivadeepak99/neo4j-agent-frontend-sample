"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(
    supabase ? null : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
  );
  
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const fetchOrgDetails = async (userId: string) => {
      if (lastFetchedUserId.current === userId && orgName !== null) return;
      lastFetchedUserId.current = userId;
      
      try {
        const { data, error } = await supabase!
          .from('org_memberships')
          .select('organizations(name)')
          .eq('user_id', userId)
          .single();
        
        if (!error && data?.organizations && !Array.isArray(data.organizations)) {
          // Cast is safe because we selected name from organizations
          setOrgName((data.organizations as any).name);
        } else {
          setOrgName(null);
        }
      } catch (err) {
        console.error("Error fetching org details", err);
        setOrgName(null);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchOrgDetails(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        fetchOrgDetails(nextSession.user.id);
      } else {
        setOrgName(null);
      }
      setAuthError(null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setAuthError("Supabase client is not configured.");
      return false;
    }
    setLoading(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setAuthError(error.message);
      return false;
    }
    setSession(data.session ?? null);
    setUser(data.user ?? null);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  return {
    session,
    user,
    orgName,
    loading,
    authError,
    accessToken: session?.access_token ?? null,
    signIn,
    signOut,
  };
}
