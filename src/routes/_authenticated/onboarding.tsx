import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpenText, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — GraceNotes" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function join() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("redeem_access_code", { _code: code.trim() });
      if (error) throw error;
      toast.success("Welcome.");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not redeem code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <BookOpenText className="h-8 w-8 mx-auto text-primary" />
          <h1 className="mt-4 font-display text-4xl">Join your organization</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the access code your administrator shared with you.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-primary" /> Access code
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GN-XXXXXXXX"
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm font-mono tracking-wider focus:ring-2 focus:ring-ring outline-none"
          />
          <button
            disabled={loading || !code}
            onClick={join}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Join workspace"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have a code yet?{" "}
          <Link to="/" className="text-primary underline">
            Request access for your organization
          </Link>
        </p>
      </div>
    </div>
  );
}
