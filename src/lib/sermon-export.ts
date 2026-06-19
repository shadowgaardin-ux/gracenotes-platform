import jsPDF from "jspdf";

type Notebook = { core_theology: string[]; action_steps: string[]; visual_metaphors: string[] };

export function downloadTranscript(title: string, transcript: string) {
  const blob = new Blob([`${title}\n\n${transcript}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}-transcript.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSermonPDF(opts: {
  title: string;
  date?: string | null;
  scripture?: string | null;
  series?: string | null;
  summary?: string | null;
  notebook: Notebook;
  references: string[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 56;
  let y = margin;

  const writeLine = (text: string, size: number, opts2: { bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    doc.setFont("helvetica", opts2.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts2.color) doc.setTextColor(...opts2.color);
    else doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, W - margin * 2);
    for (const ln of lines) {
      if (y > 740) {
        doc.addPage();
        y = margin;
      }
      doc.text(ln, margin, y);
      y += size * 1.35;
    }
    y += opts2.gap ?? 4;
  };

  writeLine("GraceNotes", 10, { color: [150, 110, 60] });
  writeLine(opts.title, 22, { bold: true, gap: 6 });
  const meta = [opts.date, opts.series, opts.scripture].filter(Boolean).join("  ·  ");
  if (meta) writeLine(meta, 10, { color: [120, 120, 120], gap: 12 });

  if (opts.summary) {
    writeLine("Summary", 12, { bold: true, color: [150, 110, 60] });
    writeLine(opts.summary, 11, { gap: 12 });
  }

  const section = (label: string, items: string[]) => {
    if (!items?.length) return;
    writeLine(label, 12, { bold: true, color: [150, 110, 60] });
    items.forEach((it) => writeLine(`•  ${it}`, 11));
    y += 8;
  };
  section("Core theology", opts.notebook.core_theology);
  section("Key action steps", opts.notebook.action_steps);
  section("Visual metaphors", opts.notebook.visual_metaphors);

  if (opts.references.length) {
    writeLine("Scripture citations", 12, { bold: true, color: [150, 110, 60] });
    writeLine(opts.references.join("  ·  "), 11);
  }

  doc.save(`${slugify(opts.title)}.pdf`);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "sermon";
}
