import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpenText, KeyRound, Church } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — GraceNotes" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");
  const [churchName, setChurchName] = useState("");
  const [loading, setLoading] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  async function join() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("redeem_access_code", { _code: code.trim() });
      if (error) throw error;
      toast.success("Welcome to your church.");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not redeem code");
    } finally {
      setLoading(false);
    }
  }

  async function createChurch() {
    if (!churchName.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_church", { _name: churchName.trim() });
      if (error) throw error;
      const adminCode = (data as any)?.[0]?.admin_code ?? null;
      setIssuedCode(adminCode);
      toast.success("Your church is ready.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not create church");
    } finally {
      setLoading(false);
    }
  }

  if (issuedCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <BookOpenText className="h-8 w-8 mx-auto text-primary" />
          <h1 className="mt-4 font-display text-3xl">Your church is set up</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share this admin access code with co-pastors. You can manage and revoke codes anytime from Settings.
          </p>
          <div className="mt-6 rounded-md border-2 border-dashed border-[color:var(--color-gold)] bg-background p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Admin code</p>
            <p className="font-mono text-2xl tracking-wider mt-1">{issuedCode}</p>
          </div>
          <button
            onClick={() => navigate({ to: "/dashboard", replace: true })}
            className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Enter dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <BookOpenText className="h-8 w-8 mx-auto text-primary" />
          <h1 className="mt-4 font-display text-4xl">One last step</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join an existing church with an access code, or create a new one.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(["join", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "join" ? "I have a code" : "Start a church"}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          {tab === "join" ? (
            <>
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
                {loading ? "Verifying…" : "Join church"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Church className="h-4 w-4 text-primary" /> Church name
              </div>
              <input
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="Grace Community Church"
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                You'll be set up as the admin and lead pastor. Two access codes will be created — one for staff, one for congregation.
              </p>
              <button
                disabled={loading || !churchName}
                onClick={createChurch}
                className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create church"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
