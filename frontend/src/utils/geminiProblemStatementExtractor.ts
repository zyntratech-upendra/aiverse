import { extractTextFromPdf } from "./pdfExtractor";

// Retrieve Gemini API Key from environment or localStorage for flexible faculty setup
export function getGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    const customKey = 
      localStorage.getItem("aiverse_gemini_api_key") || 
      localStorage.getItem("GEMINI_API_KEY") ||
      localStorage.getItem("VITE_GEMINI_API_KEY") ||
      (window as any).__GEMINI_API_KEY__;
    if (customKey && customKey.trim() && customKey.trim() !== "your_google_ai_studio_gemini_api_key") {
      return customKey.trim();
    }
  }
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
  if (envKey && envKey !== "your_google_ai_studio_gemini_api_key") {
    return envKey;
  }
  return "";
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key && key.trim()) {
      localStorage.setItem("aiverse_gemini_api_key", key.trim());
    } else {
      localStorage.removeItem("aiverse_gemini_api_key");
    }
  }
}

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
 * Automatically infers relevant track / domain from problem title & description
 */
export function inferDomainTrack(title: string, desc: string, defaultTrack: string = "General"): string {
  const combined = `${title} ${desc}`.toLowerCase();
  if (combined.match(/\b(traffic|road|roads|vehicles?|signals?|congestion|transit|commute|transport|highway)\b/i)) {
    return "Smart Cities & IoT";
  }
  if (combined.match(/\b(attendance|college|university|student|students|school|classroom|absent|gpa|grade|grades|syllabus|campus|academic)\b/i)) {
    return "EdTech & Smart Campus";
  }
  if (combined.match(/\b(delivery|route|routes|travelling|tsp|distance|vehicle|packages?|logistics|fleet|warehouse|supply chain|dispatch)\b/i)) {
    return "Logistics & Optimization";
  }
  if (combined.match(/\b(exam|examination|proctor|proctoring|security|fraud|cheat|session|malicious|auth|cyber|vulnerability|firewall|exploit)\b/i)) {
    return "Cybersecurity & Security";
  }
  if (combined.match(/\b(library|book|books|recommend|recommendation|collaborative|filtering|catalog|borrow|reading|preference|nlp)\b/i)) {
    return "AI & Recommendation Systems";
  }
  if (combined.match(/\b(ai|artificial intelligence|machine learning|deep learning|nlp|llm|computer vision|neural|dataset|model)\b/i)) {
    return "Artificial Intelligence & ML";
  }
  if (combined.match(/\b(health|hospital|doctor|patient|medical|disease|clinic|medicine|wellness|diagnosis|biomedical)\b/i)) {
    return "Healthcare & MedTech";
  }
  if (combined.match(/\b(finance|bank|banking|payment|money|loan|credit|crypto|blockchain|wallet|fintech|transaction|fraud detection)\b/i)) {
    return "FinTech & Web3";
  }
  if (combined.match(/\b(energy|power|solar|carbon|water|pollution|green|sustainable|sustainability|waste|climate|environment|grid)\b/i)) {
    return "CleanTech & Sustainability";
  }
  return defaultTrack || "General";
}

/**
 * Ultra-high-accuracy rule-based parser that scans and extracts MULTIPLE distinct problem statements.
 * Handles formats like:
 * - "Problem 1: Smart Traffic Management..."
 * - "Problem 2: College Attendance System..."
 * - "1. Delivery Route Optimization..."
 * - "Question 1: Online Examination Security..."
 * - "PS-01: Library Book Recommendation..."
 * - "Challenge 1: ..."
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
    .replace(/\u00A0/g, " ")
    .trim();

  const lines = text.split("\n").map(l => l.trim());
  const items: ExtractedProblemStatement[] = [];

  // Define regex patterns that signify the START of a new problem statement card
  // Pattern 1: Explicit labels (Problem 1, Question 1, PS-01, Challenge 1, Task 1, Theme 1, Case 1, etc.)
  const explicitMarkerRegex = /^(?:###?\s*|\*\*\s*)?(?:Problem(?:\s+Statement)?|Challenge|Question|Q\.?|Task|Theme|Track|Case\s+Study|PS)\s*[:#.-]?\s*(\d+|[A-Z0-9_-]+)(?:[\s:–—.-]+(.*))?$/i;
  
  // Pattern 2: Bracketed markers e.g. [Problem 1], [PS-01], [Challenge 2]
  const bracketMarkerRegex = /^\[\s*(?:Problem(?:\s+Statement)?|PS|Challenge|Question|Track|Task)\s*[:#.-]?\s*(\d+|[A-Z0-9_-]+)\s*\](?:\s*[:–—.-]+(.*))?$/i;

  // Pattern 3: Numbered items at line start e.g. "1. Smart Traffic Management" or "1) College Attendance"
  const numberedTitleRegex = /^(?:###?\s*|\*\*\s*)?(\d{1,3})[\.)\]]\s+([A-Za-z0-9][\w\s\-—:–,/&()']{2,})$/i;

  interface SplitMarker {
    lineIndex: number;
    rawCode: string;
    rawTitle: string;
  }

  const markers: SplitMarker[] = [];

  // Pass 1: Try finding explicit markers (Problem 1, PS-01, Question 1, Challenge 1)
  lines.forEach((line, idx) => {
    if (!line) return;

    const explicitMatch = line.match(explicitMarkerRegex);
    if (explicitMatch) {
      markers.push({
        lineIndex: idx,
        rawCode: explicitMatch[1],
        rawTitle: (explicitMatch[2] || "").trim()
      });
      return;
    }

    const bracketMatch = line.match(bracketMarkerRegex);
    if (bracketMatch) {
      markers.push({
        lineIndex: idx,
        rawCode: bracketMatch[1],
        rawTitle: (bracketMatch[2] || "").trim()
      });
    }
  });

  // Pass 2: If no explicit markers found, try numbered lists e.g. "1. Smart Traffic"
  if (markers.length === 0) {
    lines.forEach((line, idx) => {
      if (!line) return;
      const numMatch = line.match(numberedTitleRegex);
      if (numMatch) {
        // Ensure this line looks like a title/heading rather than normal paragraph continuation
        markers.push({
          lineIndex: idx,
          rawCode: numMatch[1],
          rawTitle: numMatch[2].trim()
        });
      }
    });
  }

  // If markers found, slice and construct individual problem statement cards
  if (markers.length > 0) {
    markers.forEach((marker, mIdx) => {
      const startIndex = marker.lineIndex;
      const nextMarker = markers[mIdx + 1];
      const endIndex = nextMarker ? nextMarker.lineIndex : lines.length;

      const problemLines = lines.slice(startIndex, endIndex).filter(Boolean);
      if (problemLines.length === 0) return;

      // Extract problem code
      const numPart = marker.rawCode.replace(/\D/g, "");
      const cleanCode = numPart 
        ? `PS-${numPart.padStart(2, "0")}` 
        : (marker.rawCode.toUpperCase().startsWith("PS") ? marker.rawCode.toUpperCase() : `PS-${marker.rawCode.toUpperCase()}`);

      // Extract title
      let title = marker.rawTitle;
      
      // If header had no title suffix (e.g. line was just "Problem 1:"), use next line as title
      if (!title && problemLines.length > 1) {
        const potentialTitle = problemLines[1];
        if (!potentialTitle.toLowerCase().startsWith("description") && !potentialTitle.toLowerCase().startsWith("track")) {
          title = potentialTitle;
        }
      }

      if (!title) {
        title = `Problem Statement ${mIdx + 1}`;
      }

      // Clean title artifacts (remove trailing markdown, asterisks, colons)
      title = title.replace(/^[:–—.-]+\s*/, "").replace(/[*_#]+$/g, "").trim();

      let track = "";
      let deliverables = "";
      const descLines: string[] = [];

      // Parse remaining lines in chunk
      const contentLines = problemLines.slice(1);
      for (const line of contentLines) {
        // Skip duplicate title line if it was used as title
        if (line === title) continue;

        const trackMatch = line.match(/^(?:Track|Domain|Category|Theme)\s*[:=]\s*(.+)/i);
        if (trackMatch) {
          track = trackMatch[1].replace(/[*_#]+$/g, "").trim();
          continue;
        }

        const delivMatch = line.match(/^(?:Deliverables?|Expected Output|Submissions?|Output)\s*[:=]\s*(.+)/i);
        if (delivMatch) {
          deliverables = delivMatch[1].replace(/[*_#]+$/g, "").trim();
          continue;
        }

        descLines.push(line);
      }

      const description = descLines.join("\n").trim() || title;
      const inferredTrack = track || inferDomainTrack(title, description, defaultTrack);
      const finalDeliverables = deliverables || "Working Prototype / Logic Implementation + Presentation Deck + Documentation";

      items.push({
        id: `ps_${Date.now()}_${mIdx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        code: cleanCode || `PS-0${mIdx + 1}`,
        title,
        track: inferredTrack,
        round: defaultRound,
        description,
        deliverables: finalDeliverables
      });
    });
  }

  // Pass 3: If no structured markers matched, check for multi-paragraph blocks separated by blank lines
  if (items.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 25);
    
    if (paragraphs.length > 1) {
      paragraphs.forEach((p, idx) => {
        const pLines = p.trim().split("\n").map(l => l.trim()).filter(Boolean);
        const firstLine = pLines[0] || `Problem Statement ${idx + 1}`;
        const rest = pLines.slice(1).join("\n").trim() || p.trim();

        items.push({
          id: `ps_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
          code: `PS-0${idx + 1}`,
          title: firstLine.length > 70 ? firstLine.substring(0, 70) + "..." : firstLine,
          track: inferDomainTrack(firstLine, rest, defaultTrack),
          round: defaultRound,
          description: rest,
          deliverables: "Working Prototype + Documentation"
        });
      });
    } else if (text.length > 15) {
      // Single problem statement fallback
      const firstLine = lines[0] || "Problem Statement";
      const rest = lines.slice(1).join("\n").trim() || text;

      items.push({
        id: `ps_${Date.now()}_1_${Math.random().toString(36).substring(2, 6)}`,
        code: "PS-01",
        title: firstLine.length > 75 ? firstLine.substring(0, 75) + "..." : firstLine,
        track: inferDomainTrack(firstLine, rest, defaultTrack),
        round: defaultRound,
        description: rest,
        deliverables: "Working Prototype + Documentation"
      });
    }
  }

  return items;
}

/**
 * Extracts structured problem statements using Google AI Studio (Gemini).
 * Guaranteed to extract EVERY numbered problem/question as a separate object.
 */
export async function extractProblemStatementsWithGemini(
  rawText: string,
  targetRound: number | string = "all",
  targetTrack: string = "General"
): Promise<{ problemStatements: ExtractedProblemStatement[]; usedAI: boolean; error?: string }> {
  if (!rawText || !rawText.trim()) {
    return { problemStatements: [], usedAI: false };
  }

  const apiKey = getGeminiApiKey();

  // If no Gemini API key configured, use our ultra-accurate rule parser
  if (!apiKey) {
    const localResult = parseProblemStatementsFromText(rawText, targetRound, targetTrack);
    return { problemStatements: localResult, usedAI: false };
  }

  // Attempt extraction via Gemini models in order of priority
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `You are an elite Hackathon Director, Technical Challenge Architect, and Competition Organizer.
Analyze the following text extracted from a hackathon, competition, or problem statement document (PDF or text).

CRITICAL REQUIREMENT - MULTIPLE SEPARATE PROBLEM CARDS:
- If this document contains multiple problems, questions, themes, tracks, or case studies (e.g. "Problem 1", "Problem 2", "Problem 3", "1.", "2.", "3.", "Question 1", "Question 2", "Challenge A", "Challenge B", etc.):
  YOU MUST RETURN A SEPARATE JSON OBJECT FOR EVERY SINGLE PROBLEM / QUESTION IN THE DOCUMENT.
- NEVER lump or merge multiple problems into one item.
- For example, if there are 10 problems in the document (Problem 1 to Problem 10), your JSON response MUST contain an array of exactly 10 problem statement objects.

SCHEMA TO RETURN FOR EACH OBJECT:
- "code": Standardized code (e.g. "PS-01", "PS-02", "PS-03", or explicit codes from document like "PS-102")
- "title": Clean, concise, professional problem title (e.g. "Smart Traffic Management", "College Attendance System")
- "track": The technical domain or category (e.g. "Smart Cities & IoT", "EdTech & Smart Campus", "Logistics & Optimization", "Cybersecurity & Security", "AI & Recommendation Systems", "FinTech", "Healthcare & MedTech", "CleanTech & Sustainability", "Open Innovation")
- "round": Assigned round number (e.g. 1, 2, 3) if specified, otherwise "${targetRound}"
- "description": The full problem statement description, scenario, background, requirements, constraints, and questions for this specific problem only.
- "deliverables": Expected deliverables (e.g. "Working Prototype / Logic Implementation + Presentation Deck + Documentation")

Return ONLY a strict JSON array of objects:
[
  {
    "code": "PS-01",
    "title": "Smart Traffic Management",
    "track": "Smart Cities & IoT",
    "round": "${targetRound}",
    "description": "A city has four major roads. During peak hours, Road A receives 1,200 vehicles/hour, Road B receives 900, Road C receives 1,500, and Road D receives 600. Design a method to distribute traffic signals so that the average waiting time is reduced. What data would you collect, and what algorithm or logic would you use?",
    "deliverables": "Working Prototype / Algorithm Implementation + Presentation Deck + GitHub Repository"
  },
  {
    "code": "PS-02",
    "title": "College Attendance System",
    "track": "EdTech & Smart Campus",
    "round": "${targetRound}",
    "description": "A college wants to automatically identify students who are frequently absent. Given attendance records for 500 students across 6 subjects, design a solution that identifies students with attendance below 75%, detects unusual attendance patterns, and generates a monthly report. Explain the steps and the logic you would use.",
    "deliverables": "Working Prototype + Analytics Dashboard + System Architecture Document"
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
            temperature: 0.1,
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
            id: `ps_${Date.now()}_${num}_${Math.random().toString(36).substring(2, 6)}`,
            code: (item.code || `PS-0${num}`).trim(),
            title: (item.title || `Problem Statement ${num}`).trim(),
            track: (item.track || inferDomainTrack(item.title || "", item.description || "", targetTrack)).trim(),
            round: assignedRound === "all" ? "all" : (isNaN(Number(assignedRound)) ? assignedRound : Number(assignedRound)),
            description: (item.description || "").trim(),
            deliverables: (item.deliverables || "Working Prototype + Presentation Deck + GitHub Repository").trim()
          };
        });

        return { problemStatements: formatted, usedAI: true };
      }
    } catch (err) {
      console.warn(`Error during Gemini problem statement extraction with model ${model}:`, err);
    }
  }

  // Fallback to our high-accuracy local parser
  console.log("Falling back to local high-accuracy problem statement parser");
  const localResult = parseProblemStatementsFromText(rawText, targetRound, targetTrack);
  return { problemStatements: localResult, usedAI: false };
}

/**
 * High-level helper to process File (PDF/TXT/JSON/CSV/MD) and extract individual problem statements.
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
