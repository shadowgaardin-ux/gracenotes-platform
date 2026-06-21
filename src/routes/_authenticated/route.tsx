import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const path = window.location.pathname;

      // Super admin portal — let through without org checks
      if (path.startsWith("/super-admin-portal")) {
        if (active) setChecked(true);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!active) return;

      // No org → onboarding
      if (!prof?.organization_id) {
        if (path !== "/onboarding") navigate({ to: "/onboarding", replace: true });
        setChecked(true);
        return;
      }

      // Has org — check status
      await supabase.rpc("refresh_org_status" as any, { _org_id: prof.organization_id });
      const { data: org } = await supabase
        .from("organizations")
        .select("status")
        .eq("id", prof.organization_id)
        .maybeSingle();

      const status = (org as any)?.status ?? "active";

      if (path === "/onboarding") {
        navigate({ to: "/dashboard", replace: true });
      } else if (status !== "active" && path !== "/billing") {
        navigate({ to: "/billing", replace: true });
      } else if (status === "active" && path === "/billing") {
        // allow staying on /billing to view code, no redirect
      }
      setChecked(true);
    })();
    return () => { active = false; };
  }, [navigate]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-display text-2xl text-muted-foreground">GraceNotes</div>
      </div>
    );
  }

  return <Outlet />;
}
