import React from "react";
import { 
  Sparkles, 
  Layers, 
  Calendar, 
  CheckCircle2, 
  Building2, 
  GraduationCap, 
  ChevronRight
} from "lucide-react";

interface PhaseItem {
  tag: string;
  title: string;
  body: string;
  date?: string | null;
}

interface StructuredEventOverviewProps {
  description?: string;
  company?: string;
  batch?: string;
  className?: string;
  showMetadataPills?: boolean;
}

export const parseEventOverview = (rawText?: string): {
  intro: string;
  phases: PhaseItem[];
  isStructured: boolean;
  paragraphs: string[];
} => {
  if (!rawText || !rawText.trim()) {
    return { intro: "", phases: [], isStructured: false, paragraphs: [] };
  }

  const text = rawText.trim();

  // 1. Check for Phase / Round / Stage markers in text
  // Matches "Phase 1 — The Signal", "Phase 1: The Signal", "Round 1 - Quiz", "Phase 1 - The Signal"
  const markerRegex = /(?:^|\. |\n|;\s*)(Phase\s*\d+|Round\s*\d+|Stage\s*\d+|Track\s*\d+|Step\s*\d+)\s*[:—–-]\s*([^.\n]+?)(?=\s+(?:The journey|The second|The third|The final|The grand|Scheduled|Conducted|This phase|This stage|Participants|Teams|In this|During|\.|\n|$))/gi;

  const matches: Array<{
    index: number;
    tag: string;
    title: string;
    matchEnd: number;
  }> = [];

  let m: RegExpExecArray | null;
  while ((m = markerRegex.exec(text)) !== null) {
    const matchedPrefix = m[0].startsWith(". ") ? 2 : m[0].startsWith("\n") ? 1 : 0;
    matches.push({
      index: m.index + matchedPrefix,
      tag: m[1].trim(),
      title: m[2].trim(),
      matchEnd: m.index + m[0].length,
    });
  }

  if (matches.length > 0) {
    const firstIndex = matches[0].index;
    let intro = text.substring(0, firstIndex).trim();

    const phases: PhaseItem[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
      let body = text.substring(current.matchEnd, nextIndex).trim();
      body = body.replace(/^[—–\-:\.]\s*/, "").trim();

      // Extract explicit date phrases if mentioned inside body (e.g. "conducted from 24-25 September 2026")
      const dateMatch = body.match(
        /(?:conducted from|scheduled for|dates?:|held on|from|during)\s*([0-9]{1,2}(?:-[0-9]{1,2})?\s+[A-Za-z]+(?:\s+[0-9]{4})?|[A-Za-z]+\s+[0-9]{1,2}(?:-[0-9]{1,2})?(?:,\s*[0-9]{4})?)/i
      );

      phases.push({
        tag: current.tag,
        title: current.title,
        body: body,
        date: dateMatch ? dateMatch[1] : null,
      });
    }

    return {
      intro,
      phases,
      isStructured: true,
      paragraphs: intro ? intro.split(/\n\n+/) : [],
    };
  }

  // 2. Fallback: Split by double newlines or single newlines
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    intro: text,
    phases: [],
    isStructured: false,
    paragraphs: paragraphs.length > 0 ? paragraphs : [text],
  };
};

export const StructuredEventOverview: React.FC<StructuredEventOverviewProps> = ({
  description,
  company,
  batch,
  className = "",
  showMetadataPills = true,
}) => {
  if (!description || !description.trim()) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
        <p className="text-xs text-slate-400 italic">No description provided for this event.</p>
      </div>
    );
  }

  const { intro, phases, isStructured, paragraphs } = parseEventOverview(description);

  // Helper to get color gradients per phase index
  const getPhaseColor = (index: number) => {
    const colors = [
      {
        badge: "from-blue-600 to-indigo-600 text-white",
        bg: "bg-blue-50/40 border-blue-200/70 hover:border-blue-300",
        tagText: "text-blue-700 bg-blue-100/70 border-blue-200",
        accent: "border-l-blue-500",
      },
      {
        badge: "from-purple-600 to-indigo-600 text-white",
        bg: "bg-purple-50/40 border-purple-200/70 hover:border-purple-300",
        tagText: "text-purple-700 bg-purple-100/70 border-purple-200",
        accent: "border-l-purple-500",
      },
      {
        badge: "from-amber-500 to-orange-600 text-white",
        bg: "bg-amber-50/40 border-amber-200/70 hover:border-amber-300",
        tagText: "text-amber-700 bg-amber-100/70 border-amber-200",
        accent: "border-l-amber-500",
      },
      {
        badge: "from-emerald-600 to-teal-600 text-white",
        bg: "bg-emerald-50/40 border-emerald-200/70 hover:border-emerald-300",
        tagText: "text-emerald-700 bg-emerald-100/70 border-emerald-200",
        accent: "border-l-emerald-500",
      },
    ];
    return colors[index % colors.length];
  };

  // Helper to render markdown bold / quotes / lists
  const renderFormattedText = (raw: string) => {
    // If text contains bullet lines (starting with - or * or •)
    const lines = raw.split("\n");
    const hasBullets = lines.some((l) => /^\s*[-*•]\s+/.test(l));

    if (hasBullets) {
      return (
        <div className="space-y-2">
          {lines.map((line, idx) => {
            const isBullet = /^\s*[-*•]\s+/.test(line);
            const content = line.replace(/^\s*[-*•]\s+/, "");
            if (isBullet) {
              return (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium leading-relaxed">
                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <span>{content}</span>
                </div>
              );
            }
            if (!line.trim()) return null;
            return (
              <p key={idx} className="text-xs text-slate-700 leading-relaxed font-medium">
                {line}
              </p>
            );
          })}
        </div>
      );
    }

    return (
      <p className="text-xs text-slate-750 leading-relaxed font-medium whitespace-pre-line">
        {raw}
      </p>
    );
  };

  return (
    <div className={`space-y-5 text-left ${className}`}>
      {/* 1. Company & Batch Metadata (if present) */}
      {showMetadataPills && (company || batch) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
          {company && (
            <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/40 p-3 rounded-2xl border border-blue-100 flex items-center gap-3 shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider block">Company / Host</span>
                <span className="text-xs font-bold text-slate-900 truncate block">{company}</span>
              </div>
            </div>
          )}
          {batch && (
            <div className="bg-gradient-to-r from-purple-50/80 to-pink-50/40 p-3 rounded-2xl border border-purple-100 flex items-center gap-3 shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider block">Eligible Batch</span>
                <span className="text-xs font-bold text-slate-900 truncate block">{batch}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Structured Narrative Intro / Executive Summary */}
      {intro && (
        <div className="relative rounded-2xl bg-gradient-to-br from-slate-50 via-slate-50/90 to-blue-50/30 p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-600/10 text-[#2563EB] text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#2563EB]" />
              Executive Summary
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-medium">
            {intro}
          </p>
        </div>
      )}

      {/* 3. Structured Multi-Phase Competition Breakdown (if phases detected) */}
      {isStructured && phases.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Competition Roadmap & Phases
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
              {phases.length} {phases.length === 1 ? "Phase" : "Phases"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {phases.map((phase, idx) => {
              const style = getPhaseColor(idx);
              return (
                <div
                  key={idx}
                  className={`p-4 sm:p-4.5 rounded-2xl border transition-all shadow-xs relative overflow-hidden ${style.bg}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs bg-gradient-to-r ${style.badge}`}>
                        {phase.tag}
                      </span>
                      <h5 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        {phase.title}
                      </h5>
                    </div>

                    {phase.date && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[10px] font-bold shadow-xs shrink-0 self-start sm:self-auto">
                        <Calendar className="w-3 h-3 text-blue-600" />
                        <span>{phase.date}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {phase.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Fallback Standard Paragraphs (when not structured into phases) */}
      {!isStructured && paragraphs.length > 0 && (
        <div className="space-y-3">
          {paragraphs.map((para, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 shadow-xs"
            >
              {renderFormattedText(para)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StructuredEventOverview;
