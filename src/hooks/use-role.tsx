import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

const ROLE_CHECK_TIMEOUT_MS = 10000;

function withRoleTimeout<T>(promise: PromiseLike<T>) {
  return Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error("בדיקת הרשאת האדמין נכשלה בגלל timeout")), ROLE_CHECK_TIMEOUT_MS),
    ),
  ]);
}

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    withRoleTimeout(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Admin role check failed:", error);
        setIsAdmin(!!data && !error);
        setChecking(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Admin role check failed:", error);
        setIsAdmin(false);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isAdmin, checking: checking || loading };
}
