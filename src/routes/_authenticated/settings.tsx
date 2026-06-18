import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, Sun, Moon, Monitor, LogOut, User, Palette, KeyRound, Bell } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — GraceNotes" }] }),
  component: Settings,
});

function randomCode() {
  return "GN-" + Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function Settings() {
  const { profile, roles, orgName } = useCurrentUser();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [notify, setNotify] = useState<boolean>(() =>
    typeof window !== "undefined" ? localStorage.getItem("gn-notify") !== "0" : true
  );

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  async function saveProfile() {
    if (!profile?.id) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", profile.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["current-user"] });
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-4xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
        <h1 className="mt-1 font-display text-4xl">{orgName ?? "Your account"}</h1>

        {/* Profile */}
        <Section icon={<User className="h-4 w-4" />} title="Profile" subtitle="How you appear in your church community.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Display name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="input"
              />
            </Field>
            <Field label="Email">
              <input value={profile?.email ?? ""} disabled className="input opacity-70" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground capitalize">
            Roles: {roles.join(" · ") || "member"}
          </p>
        </Section>

        {/* Appearance */}
        <Section icon={<Palette className="h-4 w-4" />} title="Appearance" subtitle="Match GraceNotes to the time of day.">
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <ThemeBtn current={theme} value="light" onClick={() => setTheme("light")} icon={<Sun className="h-4 w-4" />} label="Light" />
            <ThemeBtn current={theme} value="dark" onClick={() => setTheme("dark")} icon={<Moon className="h-4 w-4" />} label="Dark" />
            <ThemeBtn current={theme} value="system" onClick={() => setTheme("system")} icon={<Monitor className="h-4 w-4" />} label="System" />
          </div>
        </Section>

        {/* Preferences */}
        <Section icon={<Bell className="h-4 w-4" />} title="Preferences">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 max-w-xl">
            <div>
              <p className="text-sm font-medium">In-app notifications</p>
              <p className="text-xs text-muted-foreground">Toast updates when AI notes finish generating.</p>
            </div>
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => {
                setNotify(e.target.checked);
                localStorage.setItem("gn-notify", e.target.checked ? "1" : "0");
              }}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
          </label>
        </Section>

        {/* Admin codes */}
        {isAdmin && <AdminCodes orgId={profile?.organization_id ?? null} />}
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--color-background);
          border: 1px solid var(--color-input);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          color: var(--color-foreground);
        }
        .input:focus { box-shadow: 0 0 0 2px var(--color-ring); }
      `}</style>
    </AppShell>
  );
}

function Section({
  icon, title, subtitle, children,
}: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <h2 className="font-display text-2xl text-foreground">{title}</h2>
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ThemeBtn({
  current, value, onClick, icon, label,
}: { current: Theme; value: Theme; onClick: () => void; icon: React.ReactNode; label: string }) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-4 text-sm transition ${
        active ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AdminCodes({ orgId }: { orgId: string | null }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<"pastor" | "staff" | "congregation">("congregation");

  const codesQ = useQuery({
    queryKey: ["access-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function createCode() {
    if (!orgId) return;
    const { error } = await supabase.from("access_codes").insert({
      organization_id: orgId,
      code: randomCode(),
      role,
    });
    if (error) return toast.error(error.message);
    toast.success("Code created");
    qc.invalidateQueries({ queryKey: ["access-codes"] });
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this code?")) return;
    const { error } = await supabase.from("access_codes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["access-codes"] });
  }

  return (
    <Section icon={<KeyRound className="h-4 w-4" />} title="Access codes" subtitle="Share codes to invite pastors, staff, and the congregation. Each code grants the role you choose at creation.">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="pastor">Pastor</option>
          <option value="staff">Staff</option>
          <option value="congregation">Congregation</option>
        </select>
        <button
          onClick={createCode}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Create code
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card divide-y divide-border">
        {(codesQ.data?.length ?? 0) === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No codes yet.</div>
        )}
        {codesQ.data?.map((c: any) => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-sm tracking-wider">{c.code}</p>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {c.role} · {c.uses} {c.uses === 1 ? "redemption" : "redemptions"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              <button
                onClick={() => revoke(c.id)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-destructive hover:text-destructive-foreground"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
