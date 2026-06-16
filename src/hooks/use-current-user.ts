import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
};

export type AppRole = "admin" | "pastor" | "staff" | "congregation";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(u: User | null) {
      if (!u) {
        if (active) {
          setProfile(null);
          setRoles([]);
          setOrgName(null);
          setLoading(false);
        }
        return;
      }
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
      ]);
      if (!active) return;
      setProfile(p as Profile | null);
      setRoles((r ?? []).map((x: any) => x.role));
      if (p?.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", p.organization_id)
          .maybeSingle();
        if (active) setOrgName((org as any)?.name ?? null);
      } else {
        setOrgName(null);
      }
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      void load(session?.user ?? null);
    });

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      void load(data.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isPastoral = roles.includes("admin") || roles.includes("pastor");
  return { user, profile, roles, orgName, loading, isPastoral };
}
