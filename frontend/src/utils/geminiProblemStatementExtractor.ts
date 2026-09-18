import { extractTextFromPdf } from "./pdfExtractor";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Supported Google AI Studio / Gemini models in priority order
const GEMINI_MODELS = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash-exp",
  "gemini-pro"
];

export interface ExtractedProblemStatement {
  id: string;
  code: string;
  title: string;
  track: string;
  round: number | string;
  description: string;
  deliverables?: string;
}

/**
 * High-accuracy fallback rule-based parser for problem statements when AI is unavailable.
 */
export function parseProblemStatementsFromText(
  rawText: string,
  defaultRound: number | string = "all",
  defaultTrack: string = "General"
): ExtractedProblemStatement[] {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");

  const items: ExtractedProblemStatement[] = [];
  
  // Split by common problem statement delimiters
  const chunkRegex = /(?:^|\n+)(?=(?:Problem\s+(?:Statement|Topic|Challenge|Track)|PS\s*[:#-]?\s*\d+|Challenge\s*[:#-]?\s*\d+|Track\s*[:#-]?\s*\d+)\b)/i;
  const chunks = text.split(chunkRegex).filter(c => c.trim().length > 15);

  if (chunks.length > 0) {
    chunks.forEach((chunk, idx) => {
      const lines = chunk.trim().split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const firstLine = lines[0];
      let code = `PS-0${idx + 1}`;
      let title = firstLine;

      const codeMatch = firstLine.match(/(?:PS|Challenge|Track|Problem(?:\s+Statement)?)\s*[:#-]?\s*(\d+|[A-Z0-9_-]+)/i);
      if (codeMatch) {
        code = `PS-${codeMatch[1].padStart(2, "0")}`;
        title = firstLine.replace(/^(?:PS|Challenge|Track|Problem(?:\s+Statement)?)\s*[:#-]?\s*(\d+|[A-Z0-9_-]+)\s*[:–—#-]?\s*/i, "").trim();
      }

      if (!title && lines.length > 1) {
        title = lines[1];
      }

      let track = defaultTrack;
      let deliverables = "";
      const descLines: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^(?:Track|Domain|Category|Theme)\s*[:=]\s*(.+)/i.test(line)) {
          const match = line.match(/^(?:Track|Domain|Category|Theme)\s*[:=]\s*(.+)/i);
          if (match) track = match[1].trim();
        } else if (/^(?:Deliverables?|Expected Output|Submissions?)\s*[:=]\s*(.+)/i.test(line)) {
          const match = line.match(/^(?:Deliverables?|Expected Output|Submissions?)\s*[:=]\s*(.+)/i);
          if (match) deliverables = match[1].trim();
        } else {
          descLines.push(line);
        }
      }

      const description = descLines.join("\n").trim() || chunk.trim();

      items.push({
        id: `ps_${Date.now()}_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        code: code || `PS-0${idx + 1}`,
        title: title || `Problem Statement ${idx + 1}`,
        track: track || defaultTrack,
        round: defaultRound,
        description,
        deliverables: deliverables || "Working Prototype + Presentation Deck + GitHub Repository"
      });
    });
  }

  // If no structured chunks found, treat whole text as a single problem statement
  if (items.length === 0 && text.trim().length > 10) {
    const firstLine = text.trim().split("\n")[0] || "Problem Statement";
    items.push({
      id: `ps_${Date.now()}_1_${Math.random().toString(36).substr(2, 4)}`,
      code: "PS-01",
      title: firstLine.length > 80 ? firstLine.substring(0, 80) + "..." : firstLine,
      track: defaultTrack,
      round: defaultRound,
      description: text.trim(),
      deliverables: "Working Prototype + Documentation"
    });
  }

  return items;
}

/**
 * Extracts structured problem statements using Google AI Studio (Gemini).
 * If Gemini fails or API key is not configured, falls back to local pattern-based parser.
 */
export async function extractProblemStatementsWithGemini(
  rawText: string,
  targetRound: number | string = "all",
  targetTrack: string = "General"
): Promise<{ problemStatements: ExtractedProblemStatement[]; usedAI: boolean; error?: string }> {
  if (!rawText || !rawText.trim()) {
    return { problemStatements: [], usedAI: false };
  }

  const apiKey = GEMINI_API_KEY.trim();

  // If no Gemini API key configured, use local rule parser
  if (!apiKey || apiKey === "your_google_ai_studio_gemini_api_key") {
    const localResult = parseProblemStatementsFromText(rawText, targetRound, targetTrack);
    return { problemStatements: localResult, usedAI: false };
  }

  // Attempt extraction via Gemini models in order of priority
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `You are an elite Hackathon Director, Technical Challenge Architect, and Competition Organizer.
Analyze the following text extracted from an official hackathon, competition, or problem statement document (PDF or text).

TASK:
1. Accurately identify and extract ALL Problem Statements, Challenges, Tracks, Project Themes, or Problem Briefs present in the document.
2. For each extracted problem statement, extract:
   - "code": An identifier code (e.g. "PS-01", "PS-02", "TRACK-01", or preserve explicit codes from the text like "PS-102", "CH-04")
   - "title": A clear, concise, professional title summarizing the problem
   - "track": The technology domain or theme (e.g. "Artificial Intelligence & ML", "FinTech", "HealthTech", "Web3 & Blockchain", "Cybersecurity", "Smart Cities & IoT", "EdTech", "Clean Energy & Sustainability", "Open Innovation")
   - "round": Assigned round number (e.g. 1, 2, 3) if specified in document, otherwise use "${targetRound}"
   - "description": Complete, detailed description explaining the background problem, requirements, constraints, user personas, and goals
   - "deliverables": Clear list of expected submissions (e.g. "Working Prototype, GitHub Repository with README, Presentation Deck (PPT), Demo Video")

Return ONLY a strict JSON array of problem statement objects following this exact schema:
[
  {
    "code": "PS-01",
    "title": "Smart Campus Energy Management System",
    "track": "Artificial Intelligence & ML",
    "round": "${targetRound}",
    "description": "Detailed background, constraints, and requirements here...",
    "deliverables": "Working Prototype + GitHub Repo + Pitch Deck"
  }
]

DOCUMENT CONTENT TO PARSE:
"""
${rawText}
"""`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawOutputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!rawOutputText) {
        continue;
      }

      // Clean JSON output (strip backticks if any)
      const cleanJson = rawOutputText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsedJson = JSON.parse(cleanJson);

      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        const formatted: ExtractedProblemStatement[] = parsedJson.map((item: any, idx: number) => {
          const num = idx + 1;
          const assignedRound = item.round !== undefined && item.round !== null ? item.round : targetRound;

          return {
            id: `ps_${Date.now()}_${num}_${Math.random().toString(36).substr(2, 4)}`,
            code: (item.code || `PS-0${num}`).trim(),
            title: (item.title || `Problem Statement ${num}`).trim(),
            track: (item.track || targetTrack || "General").trim(),
            round: assignedRound === "all" ? "all" : (isNaN(Number(assignedRound)) ? assignedRound : Number(assignedRound)),
            description: (item.description || "").trim(),
            deliverables: (item.deliverables || "Working Prototype + Documentation").trim()
          };
        });

        return { problemStatements: formatted, usedAI: true };
      }
    } catch (err) {
      console.warn(`Error during Gemini problem statement extraction with model ${model}:`, err);
    }
  }

  // Fallback to local rule parser
  console.log("Falling back to local pattern-based problem statement parser");
  const localResult = parseProblemStatementsFromText(rawText, targetRound, targetTrack);
  return { problemStatements: localResult, usedAI: false };
}

/**
 * High-level helper to process File (PDF/TXT/JSON/CSV) or Raw Text string and extract problem statements via Gemini.
 */
export async function extractProblemStatementsFromFile(
  file: File,
  targetRound: number | string = "all",
  targetTrack: string = "General"
): Promise<{ problemStatements: ExtractedProblemStatement[]; usedAI: boolean; rawText: string; error?: string }> {
  try {
    let rawText = "";

    if (file.name.toLowerCase().endsWith(".pdf")) {
      rawText = await extractTextFromPdf(file);
    } else {
      rawText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = () => resolve("");
        reader.readAsText(file);
      });
    }

    if (!rawText || !rawText.trim()) {
      return { problemStatements: [], usedAI: false, rawText: "", error: "File content is empty or could not be read." };
    }

    const { problemStatements, usedAI, error } = await extractProblemStatementsWithGemini(
      rawText,
      targetRound,
      targetTrack
    );

    return { problemStatements, usedAI, rawText, error };
  } catch (err: any) {
    console.error("Failed to extract problem statements from file:", err);
    return { problemStatements: [], usedAI: false, rawText: "", error: err?.message || "Extraction failed" };
  }
}
