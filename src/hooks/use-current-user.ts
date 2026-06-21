import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
};

export type AppRole = "admin" | "pastor" | "staff" | "congregation" | "super_admin";

export type OrgStatus = "pending_payment" | "pending_review" | "active" | "expired" | "suspended";

export type OrgInfo = {
  id: string;
  name: string;
  status: OrgStatus;
  subscription_expires_at: string | null;
  subscription_price_cents: number | null;
  subscription_currency: string | null;
} | null;

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [org, setOrg] = useState<OrgInfo>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(u: User | null) {
      if (!u) {
        if (active) {
          setProfile(null);
          setRoles([]);
          setOrg(null);
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
        // refresh_org_status flips to expired if past due
        await supabase.rpc("refresh_org_status" as any, { _org_id: p.organization_id });
        const { data: orgRow } = await supabase
          .from("organizations")
          .select("id,name,status,subscription_expires_at,subscription_price_cents,subscription_currency")
          .eq("id", p.organization_id)
          .maybeSingle();
        if (active) setOrg(orgRow as OrgInfo);
      } else {
        setOrg(null);
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
  const isSuperAdmin = roles.includes("super_admin");
  const isOrgAdmin = roles.includes("admin");
  const orgActive = org?.status === "active";
  // backwards-compat
  const orgName = org?.name ?? null;
  return { user, profile, roles, org, orgName, loading, isPastoral, isSuperAdmin, isOrgAdmin, orgActive };
}
