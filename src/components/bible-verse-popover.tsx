import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";

type VerseState = { loading: boolean; text?: string; error?: string };

export function BibleVersePopover({ reference }: { reference: string }) {
  const [state, setState] = useState<VerseState>({ loading: false });

  async function load() {
    if (state.text || state.loading) return;
    setState({ loading: true });
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=web`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setState({ loading: false, text: data.text?.trim() ?? "" });
    } catch (e: any) {
      setState({ loading: false, error: "Couldn't load verse." });
    }
  }

  return (
    <Popover onOpenChange={(o) => o && load()}>
      <PopoverTrigger asChild>
        <button className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:border-primary/40 inline-flex items-center gap-1.5">
          <BookOpen className="h-3 w-3" />
          {reference}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="font-display text-sm text-primary">{reference}</p>
        <div className="mt-2 min-h-[60px] text-sm leading-relaxed">
          {state.loading && (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading verse…
            </span>
          )}
          {state.error && <span className="text-muted-foreground italic">{state.error}</span>}
          {state.text && <p className="whitespace-pre-wrap text-foreground/90">{state.text}</p>}
        </div>
        <a
          href={`https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open in BibleGateway <ExternalLink className="h-3 w-3" />
        </a>
      </PopoverContent>
    </Popover>
  );
}
