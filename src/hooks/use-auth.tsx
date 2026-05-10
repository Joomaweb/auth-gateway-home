import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const AUTH_TIMEOUT_MS = 10000;

function withAuthTimeout<T>(promise: PromiseLike<T>) {
  return Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      globalThis.setTimeout(() => reject(new Error("בדיקת ההתחברות לוקחת יותר מדי זמן")), AUTH_TIMEOUT_MS),
    ),
  ]);
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    withAuthTimeout(supabase.auth.getSession())
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Auth session check failed:", error);
        setSession(null);
        setLoading(false);
      });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
