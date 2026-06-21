import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpenText, Sparkles, Lock, Quote, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GraceNotes — AI tools built for the local church" },
      { name: "description", content: "Transcribe sermons, multiply your message across social and print, and steward pastoral care in a secure vault. Built for churches of every size." },
      { property: "og:title", content: "GraceNotes — AI tools built for the local church" },
      { property: "og:description", content: "Transcribe sermons, multiply your message across social and print, and steward pastoral care in a secure vault." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [showInquiry, setShowInquiry] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-primary" />
            <span className="font-display text-2xl tracking-tight">GraceNotes</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="paper-grain absolute inset-0 opacity-60 pointer-events-none" />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-24 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
            For pastors, staff, and the people they serve
          </div>
          <h1 className="mt-8 font-display text-5xl sm:text-7xl text-balance leading-[1.05]">
            Every word, <span className="italic text-primary">multiplied</span>.<br />
            Every soul, <span className="italic">remembered</span>.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground text-balance">
            GraceNotes is a quiet, careful AI platform for the local church. Turn one sermon into a week of bulletins, social posts, and small-group guides — and keep the sacred work of pastoral care in a vault only you can open.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setShowInquiry(true)}
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Request access for your organization
            </button>
            <Link
              to="/auth"
              className="rounded-md border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              I have an access code
            </Link>
          </div>
          <div className="mt-12 h-px gold-line" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: Sparkles,
            title: "Sermon Multiplier",
            body: "Paste a transcript or upload prepared notes. GraceNotes drafts a week of micro-posts, bulletins, newsletter copy, and small-group questions — all in your voice.",
          },
          {
            icon: Quote,
            title: "Scripture Citation",
            body: "Every reference spoken from the pulpit is identified, formatted, and cross-linked. No more hunting for the chapter or fixing the citation in your notes.",
          },
          {
            icon: Lock,
            title: "Pastoral Vault",
            body: "Counseling notes, sermon drafts, and confidential records live in an isolated vault. Only verified pastoral roles can read or write — enforced at the database level.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-7">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-5 font-display text-2xl">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} GraceNotes · Made for the church
      </footer>
    </div>
  );
}
