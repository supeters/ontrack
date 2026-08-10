'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getClientBrowserClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface Kid {
  id: number;
  name: string;
  user_id?: string;
}

interface AuthContextType {
  user: User | null;
  kids: Kid[];
  selectedKid: Kid | null;
  setSelectedKid: (kid: Kid | null) => void;
  signInWithGoogle: () => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  kids: [],
  selectedKid: null,
  setSelectedKid: () => {},
  signInWithGoogle: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Kid[]>([]);
  const [selectedKid, setSelectedKid] = useState<Kid | null>(null);

  const supabase = getClientBrowserClient();

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadKids(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadKids(session.user.id);
      } else {
        setKids([]);
        setSelectedKid(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadKids = async (userId: string) => {
    // First, find the kid record for this user
    const { data: userKid, error: userKidError } = await supabase
      .from('kids')
      .select('id, name, user_id')
      .eq('user_id', userId)
      .single();

    if (userKidError) {
      console.error('Error loading user kid:', userKidError);
      return;
    }

    if (!userKid) {
      console.log('No kid found for user');
      return;
    }

    // If this user IS a kid (student), show themselves
    // Otherwise, get all kids related to this parent
    const { data: relations, error: relationsError } = await supabase
      .from('kid_relations')
      .select('kid_id, kids!kid_relations_kid_id_fkey(*)')
      .eq('parent_id', userKid.id);

    if (relationsError) {
      console.error('Error loading kid relations:', relationsError);
    }

    let kidsList: Kid[] = [];

    if (relations && relations.length > 0) {
      // User is a parent - show their children
      kidsList = relations.map((r: any) => r.kids).filter((k: any) => k !== null);
    } else {
      // User is a student - show themselves
      kidsList = [userKid];
    }

    console.log('Loaded kids:', kidsList);
    setKids(kidsList);
    if (kidsList.length === 1) {
      setSelectedKid(kidsList[0]);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setKids([]);
    setSelectedKid(null);
    return { error };
  };

  const value = {
    user,
    kids,
    selectedKid,
    setSelectedKid,
    signInWithGoogle,
    signIn,
    signUp,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
