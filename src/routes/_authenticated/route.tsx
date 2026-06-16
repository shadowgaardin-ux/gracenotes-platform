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

  // Onboarding gate: if user has no organization, route to /onboarding.
  // This runs after auth so it never loops.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!active) return;
      const path = window.location.pathname;
      if (!prof?.organization_id && path !== "/onboarding") {
        navigate({ to: "/onboarding", replace: true });
      } else if (prof?.organization_id && path === "/onboarding") {
        navigate({ to: "/dashboard", replace: true });
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
