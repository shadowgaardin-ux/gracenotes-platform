import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mic, Square, Pause, Play, Upload, Link2, FileText, Sparkles, X, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type Tab = "record" | "upload" | "url" | "text";

// strip "data:audio/webm;codecs=opus;base64,...."
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

export function NewSermonDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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

  function reset() {
    setTab("record");
    setTitle("");
    setShared(false);
    setTranscript("");
    setAudioDataUrl("");
    setAudioUrl("");
  }

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

  async function handleSave() {
    if (!profile?.organization_id) {
      toast.error("Join a church first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Give your sermon a title.");
      return;
    }
    setSaving(true);
    try {
      const sourceKind = tab === "text" ? "text" : tab === "record" ? "recording" : tab === "upload" ? "upload" : "url";
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

      if (transcript.trim().length > 40) {
        toast.message("Generating AI notes…");
        const { generateSermonContent } = await import("@/lib/ai.functions");
        await generateSermonContent({ data: { sermonId: data.id, transcript, title: title.trim() } }).catch(() => {});
      }
      toast.success("Sermon saved to your notebook.");
      onOpenChange(false);
      reset();
      navigate({ to: "/sermons/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Personal notebook</p>
            <h2 className="font-display text-2xl">New sermon</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2 rounded-md hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sermon title (e.g. Sunday — The Good Shepherd)"
            className="w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="px-6 pt-4">
          <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg">
            <TabBtn active={tab === "record"} onClick={() => setTab("record")} icon={<Mic className="h-3.5 w-3.5" />} label="Record" />
            <TabBtn active={tab === "upload"} onClick={() => setTab("upload")} icon={<Upload className="h-3.5 w-3.5" />} label="Upload" />
            <TabBtn active={tab === "url"} onClick={() => setTab("url")} icon={<Link2 className="h-3.5 w-3.5" />} label="URL" />
            <TabBtn active={tab === "text"} onClick={() => setTab("text")} icon={<FileText className="h-3.5 w-3.5" />} label="Paste text" />
          </div>
        </div>

        <div className="px-6 py-5">
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
              <p className="text-xs text-muted-foreground">We'll attach the link to this entry. Paste a transcript below to unlock AI notes.</p>
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Transcript {tab === "text" ? "" : "(auto-generated)"}
              </label>
              {transcribing && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Transcribing with Gemini…
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
              rows={tab === "text" ? 10 : 6}
              placeholder={
                tab === "text"
                  ? "Paste the sermon transcript or jot key points."
                  : "Your transcript will appear here after recording or uploading. You can edit it freely."
              }
              className="mt-1.5 w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm leading-relaxed font-mono outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-muted/30">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-medium">Share to Church Hub</span>
              <span className="ml-2 text-xs text-muted-foreground">{shared ? "Visible to your congregation" : "Private to your notebook"}</span>
            </span>
          </label>
          <button
            disabled={saving || transcribing || !title.trim()}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {saving ? "Saving…" : "Save sermon"}
          </button>
        </div>
      </div>
    </div>
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

// ---------- Live recording ----------
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

  useEffect(() => {
    return () => cleanup();
  }, []);

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
          <div className="absolute inset-2 rounded-full bg-primary/25" style={{ transform: `scale(${1 + level * 0.4})`, transition: "transform 80ms linear" }} />
          <div className={`absolute inset-4 rounded-full grid place-items-center ${state === "recording" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Mic className="h-6 w-6" />
          </div>
        </div>
        <div className="flex-1">
          <div className="font-display text-3xl tabular-nums">{mm}:{ss}</div>
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

      {blobUrl && (
        <audio src={blobUrl} controls className="mt-4 w-full" />
      )}
    </div>
  );
}

// ---------- Upload ----------
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
      <p className="mt-1 text-xs text-muted-foreground">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB — transcribing automatically` : "or click to browse"}</p>
    </label>
  );
}
