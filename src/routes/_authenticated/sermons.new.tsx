import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mic,
  Square,
  Pause,
  Play,
  Upload,
  Link2,
  FileText,
  Sparkles,
  Loader2,
  Wand2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/sermons/new")({
  head: () => ({ meta: [{ title: "New sermon — GraceNotes" }] }),
  component: NewSermon,
});

type Tab = "record" | "upload" | "url" | "text";

function splitDataUrl(dataUrl: string): { base64: string; mime: string } {
  const m = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!m) return { base64: "", mime: "" };
  return { mime: m[1], base64: m[2] };
}

function mimeToFormat(mime: string): "webm" | "mp3" | "wav" | "m4a" | "ogg" | "aac" | "flac" {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav") || m.includes("wave")) return "wav";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("flac")) return "flac";
  return "webm";
}

function NewSermon() {
  const { profile } = useCurrentUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("record");
  const [title, setTitle] = useState("");
  const [shared, setShared] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function runTranscription(dataUrl: string) {
    const { base64, mime } = splitDataUrl(dataUrl);
    if (!base64) return toast.error("Couldn't read audio data");
    setTranscribing(true);
    try {
      const { transcribeAudio } = await import("@/lib/ai.functions");
      const { transcript: t } = await transcribeAudio({
        data: { audioBase64: base64, format: mimeToFormat(mime) },
      });
      setTranscript(t);
      toast.success("Transcribed.");
    } catch (e: any) {
      toast.error(e.message ?? "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleAudioCaptured(dataUrl: string) {
    setAudioDataUrl(dataUrl);
    await runTranscription(dataUrl);
  }

  async function saveOnly() {
    if (!profile?.organization_id) return toast.error("Join a church first.");
    if (!title.trim()) return toast.error("Give your sermon a title.");
    setSaving(true);
    try {
      const sourceKind =
        tab === "text" ? "text" : tab === "record" ? "recording" : tab === "upload" ? "upload" : "url";
      const { data, error } = await supabase
        .from("sermons")
        .insert({
          organization_id: profile.organization_id,
          author_id: profile.id,
          title: title.trim(),
          transcript: transcript || null,
          audio_url: audioUrl || null,
          source_kind: sourceKind,
          visibility: shared ? "shared" : "private",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Transcript saved.");
      navigate({ to: "/sermons/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndGenerate() {
    if (!profile?.organization_id) return toast.error("Join a church first.");
    if (!title.trim()) return toast.error("Give your sermon a title.");
    if (transcript.trim().length < 40) return toast.error("Transcribe or paste more text before generating.");
    setSaving(true);
    try {
      const sourceKind =
        tab === "text" ? "text" : tab === "record" ? "recording" : tab === "upload" ? "upload" : "url";
      const { data, error } = await supabase
        .from("sermons")
        .insert({
          organization_id: profile.organization_id,
          author_id: profile.id,
          title: title.trim(),
          transcript,
          audio_url: audioUrl || null,
          source_kind: sourceKind,
          visibility: shared ? "shared" : "private",
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.message("Generating AI summary & topic tag…");
      const { generateSermonContent } = await import("@/lib/ai.functions");
      await generateSermonContent({
        data: { sermonId: data.id, transcript, title: title.trim() },
      });
      toast.success("Sermon ready.");
      navigate({ to: "/sermons/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const hasRawTranscript = transcript.trim().length > 0;

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-3xl">
        <Link to="/sermons" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All sermons
        </Link>
        <div className="mt-3 flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Personal notebook</p>
            <h1 className="font-display text-4xl">New sermon</h1>
            <p className="mt-2 text-sm text-muted-foreground">Step 1 — capture the raw transcript. Step 2 — generate the AI summary & topic.</p>
          </div>
        </div>

        <div className="mt-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sermon title (e.g. Sunday — The Good Shepherd)"
            className="w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg">
          <TabBtn active={tab === "record"} onClick={() => setTab("record")} icon={<Mic className="h-3.5 w-3.5" />} label="Record" />
          <TabBtn active={tab === "upload"} onClick={() => setTab("upload")} icon={<Upload className="h-3.5 w-3.5" />} label="Upload" />
          <TabBtn active={tab === "url"} onClick={() => setTab("url")} icon={<Link2 className="h-3.5 w-3.5" />} label="URL" />
          <TabBtn active={tab === "text"} onClick={() => setTab("text")} icon={<FileText className="h-3.5 w-3.5" />} label="Paste text" />
        </div>

        <div className="mt-5">
          {tab === "record" && <RecorderPanel onAudio={handleAudioCaptured} />}
          {tab === "upload" && <UploadPanel onPicked={handleAudioCaptured} />}
          {tab === "url" && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Audio or stream URL</label>
              <input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://…/sermon.mp3"
                className="w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">We'll attach the link. Paste a transcript below to unlock the AI step.</p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Step 1 · Raw transcript {tab === "text" ? "" : "(auto)"}
            </label>
            {transcribing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
              </span>
            )}
            {!transcribing && audioDataUrl && (
              <button
                onClick={() => runTranscription(audioDataUrl)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Wand2 className="h-3 w-3" /> Re-transcribe
              </button>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={tab === "text" ? 14 : 10}
            placeholder={
              tab === "text"
                ? "Paste the sermon transcript or jot key points."
                : "Your raw transcript will appear here. Review and edit — no AI has run yet."
            }
            style={{ color: hasRawTranscript ? "#dc2626" : undefined }}
            className="mt-1.5 w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm leading-relaxed font-mono outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {hasRawTranscript && (
            <p className="mt-1.5 text-[11px] text-[#dc2626]/80">
              Raw uninterpreted text. Tap "Generate AI Summary" below to produce the pastoral summary, key bullets & topic tag.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-medium">Share to Church Hub</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {shared ? "Visible to your congregation" : "Private to your notebook"}
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Step 2 · AI processing</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground max-w-md">
              The AI will summarize the message, pull key action steps, cite scriptures, and auto-assign a Primary Topic Tag.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={saving || transcribing || !title.trim() || !hasRawTranscript}
                onClick={saveOnly}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Save transcript only
              </button>
              <button
                disabled={saving || transcribing || !title.trim() || !hasRawTranscript}
                onClick={saveAndGenerate}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                {saving ? "Working…" : "Generate AI Summary & Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
        active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function RecorderPanel({ onAudio }: { onAudio: (dataUrl: string) => void | Promise<void> }) {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        const reader = new FileReader();
        reader.onloadend = () => onAudio(String(reader.result));
        reader.readAsDataURL(blob);
      };
      rec.start();

      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch (e: any) {
      toast.error(e.message ?? "Microphone access denied");
    }
  }

  function pause() {
    mediaRef.current?.pause();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setState("paused");
  }
  function resume() {
    mediaRef.current?.resume();
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    setState("recording");
  }
  function stop() {
    mediaRef.current?.stop();
    cleanup();
    setLevel(0);
    setState("stopped");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-background/60 p-6">
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0">
          <div
            className="absolute inset-0 rounded-full bg-primary/15"
            style={{ transform: `scale(${1 + level * 0.6})`, transition: "transform 80ms linear" }}
          />
          <div
            className="absolute inset-2 rounded-full bg-primary/25"
            style={{ transform: `scale(${1 + level * 0.4})`, transition: "transform 80ms linear" }}
          />
          <div
            className={`absolute inset-4 rounded-full grid place-items-center ${
              state === "recording" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Mic className="h-6 w-6" />
          </div>
        </div>
        <div className="flex-1">
          <div className="font-display text-3xl tabular-nums">
            {mm}:{ss}
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {state === "idle" && "Press record. We'll transcribe automatically when you stop."}
            {state === "recording" && "Recording in progress…"}
            {state === "paused" && "Paused — tap resume to continue."}
            {state === "stopped" && "Recording captured — transcription will start shortly."}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {state === "idle" && (
          <button onClick={start} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Mic className="h-4 w-4" /> Record
          </button>
        )}
        {state === "recording" && (
          <>
            <button onClick={pause} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-accent">
              <Pause className="h-4 w-4" /> Pause
            </button>
            <button onClick={stop} className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90">
              <Square className="h-4 w-4" /> Stop & transcribe
            </button>
          </>
        )}
        {state === "paused" && (
          <>
            <button onClick={resume} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <Play className="h-4 w-4" /> Resume
            </button>
            <button onClick={stop} className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90">
              <Square className="h-4 w-4" /> Stop & transcribe
            </button>
          </>
        )}
        {state === "stopped" && (
          <button
            onClick={() => {
              setSeconds(0);
              setBlobUrl(null);
              setState("idle");
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
          >
            <Mic className="h-4 w-4" /> Record again
          </button>
        )}
      </div>

      {blobUrl && <audio src={blobUrl} controls className="mt-4 w-full" />}
    </div>
  );
}

function UploadPanel({ onPicked }: { onPicked: (dataUrl: string) => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);

  function handle(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      toast.error("Please pick an audio file (MP3, WAV, M4A…).");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onloadend = () => onPicked(String(reader.result));
    reader.readAsDataURL(f);
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files?.[0] ?? null);
      }}
      className={`block rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition ${
        drag ? "border-primary bg-primary/5" : "border-border bg-background/60 hover:border-primary/40"
      }`}
    >
      <input type="file" accept="audio/*" className="hidden" onChange={(e) => handle(e.target.files?.[0] ?? null)} />
      <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{file ? file.name : "Drop an MP3 or WAV here"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB — transcribing automatically` : "or click to browse"}
      </p>
    </label>
  );
}
