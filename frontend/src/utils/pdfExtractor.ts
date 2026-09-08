import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { QuizQuestion } from "../types/quiz";

// Configure PDF.js worker reliably via Vite URL
if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (e) {
    console.warn("Could not set pdf workerSrc", e);
  }
}

/**
 * Extracts complete plain text from a PDF File across all pages.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });

    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let pageStr = "";

      for (const item of textContent.items) {
        if ("str" in item) {
          const itemStr = item.str;
          // If Y coordinate changes significantly, treat as new line
          const currentY = "transform" in item && Array.isArray(item.transform) ? item.transform[5] : null;
          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 4) {
            pageStr += "\n";
          } else if (pageStr.length > 0 && !pageStr.endsWith(" ") && !pageStr.endsWith("\n") && itemStr.trim().length > 0) {
            pageStr += " ";
          }
          pageStr += itemStr;
          if (currentY !== null) {
            lastY = currentY;
          }
        }
      }

      if (pageStr.trim()) {
        pageTexts.push(pageStr.trim());
      }
    }

    return pageTexts.join("\n\n");
  } catch (err) {
    console.error("PDF.js extraction failed, falling back to stream reader", err);
    return await fallbackExtractRaw(file);
  }
}

/**
 * Fallback reader for text files or raw stream extraction
 */
async function fallbackExtractRaw(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) || "";
      const clean = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");
      resolve(clean);
    };
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

/**
 * High-accuracy MCQ Question Parser
 * Fully supports:
 * - Standard numbered: 1. Question / Q1. Question / 1) Question / Question 1:
 * - Options: A) / A. / (A) / [A] / a. / a) / (a)
 * - Answers: "Answer: B. Initial state", "Answer: B", "Ans: B", "Key: B", "Correct: Option B"
 * - Inline answers in option D: "D. Evaluation state Answer: B"
 * - Bottom Answer Key tables: "Answer Key: 1. B, 2. A..."
 */
export function parseQuestionsFromText(rawText: string, defaultCategory: string): QuizQuestion[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize text: replace non-breaking spaces, standardize quotes, dashes, bullet points
  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/•/g, " ");

  // Check if there is an Answer Key section at the bottom (e.g. "Answer Key", "Answers:", "Key:")
  const answerKeyMap: Record<number, string> = {};
  const answerKeyMatch = text.match(/(?:answer\s*key|answers\s*key|keys?\s*list|correct\s*answers?)\s*[\:\-\n]([\s\S]+)$/i);
  if (answerKeyMatch) {
    const keySection = answerKeyMatch[1];
    const keyPairs = keySection.matchAll(/(?:(?:Q(?:uestion)?\s*)?(\d+)[\.\:\-\)\s]+(?:\(?([A-Da-d1-4])\)?))/g);
    for (const match of keyPairs) {
      const qNum = parseInt(match[1], 10);
      const ans = match[2].toUpperCase();
      if (qNum && ans) {
        answerKeyMap[qNum] = ans;
      }
    }
  }

  // Split multiple options on the same line (e.g., "A. First B. Second C. Third D. Fourth")
  // Only split when NOT preceded by "Answer:" or "Ans:" or "Key:"
  text = text.replace(/(?<!(?:Answer|Ans|Key|Correct)\s*[\:\-\=]?\s*)([^\n])\s+([A-Da-d]\s*[\)\.\:\-]\s+)/gi, "$1\n$2");
  text = text.replace(/(?<!(?:Answer|Ans|Key|Correct)\s*[\:\-\=]?\s*)([^\n])\s+(\([A-Da-d]\)\s+)/gi, "$1\n$2");

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const questions: QuizQuestion[] = [];

  let currentQ: {
    rawNum?: number;
    text: string;
    category?: string;
    points?: number;
    options: { id: string; text: string }[];
    correctAnswer?: string;
  } | null = null;

  const pushCurrentQuestion = () => {
    if (!currentQ || !currentQ.text || currentQ.options.length < 2) return;

    const qNum = questions.length + 1;
    let correctId = "opt_a";
    
    // Check answer from question itself or from bottom answer key
    const rawAnswer = currentQ.correctAnswer || (currentQ.rawNum ? answerKeyMap[currentQ.rawNum] : undefined);
    
    if (rawAnswer) {
      const ansChar = rawAnswer.trim().toUpperCase();
      if (ansChar === "B" || ansChar === "2" || ansChar === "OPT_B") correctId = "opt_b";
      else if (ansChar === "C" || ansChar === "3" || ansChar === "OPT_C") correctId = "opt_c";
      else if (ansChar === "D" || ansChar === "4" || ansChar === "OPT_D") correctId = "opt_d";
      else if (ansChar === "A" || ansChar === "1" || ansChar === "OPT_A") correctId = "opt_a";
    }

    // Ensure 4 options
    const formattedOptions = [...currentQ.options];
    const optionIds = ["opt_a", "opt_b", "opt_c", "opt_d"];
    while (formattedOptions.length < 4) {
      const missingId = optionIds[formattedOptions.length];
      formattedOptions.push({
        id: missingId,
        text: `Option ${formattedOptions.length + 1}`
      });
    }

    questions.push({
      id: `q_${Date.now()}_${qNum}_${Math.random().toString(36).substr(2, 4)}`,
      questionNumber: qNum,
      text: currentQ.text.replace(/^[\d\.\)\:\s\-]+/, "").trim(),
      points: currentQ.points || 2,
      category: currentQ.category || defaultCategory || "General",
      options: formattedOptions.slice(0, 4),
      correctOptionId: correctId
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stop parsing if we reach the Answer Key section at the bottom
    if (/^(?:answer\s*key|answers\s*key|key\s*sheet|keys?\s*list)[\:\-\s]/i.test(line)) {
      break;
    }

    // 1. Check for ANSWER LINE first! (Highest priority so "Answer: B. Initial state" is never misidentified)
    // Matches: "Answer: B. Initial state", "Answer: B", "Ans: B", "Answer: (B)", "Key: B", "Correct: Option B", "Ans. B"
    const ansLineMatch = line.match(/^(?:Answer|Ans|Correct(?:\s*Answer)?|Key)\s*[\:\-\=\.]*\s*(?:Option)?\s*\(?\[?([A-Da-d1-4])\)?\]?(?:[\.\:\)\s\-]+.*)?$/i);
    if (ansLineMatch && currentQ) {
      currentQ.correctAnswer = ansLineMatch[1].toUpperCase();
      continue;
    }

    // 2. Check for QUESTION START
    // Matches: "1. What is...", "Q1. What is...", "1) What is...", "Question 1: What is...", "(1) What is..."
    const qMatch = line.match(/^(?:(?:(?:\(?Q(?:uestion)?\s*)?(\d+)[\.\:\)\-]\s*))(.+)/i);
    if (qMatch) {
      pushCurrentQuestion();
      currentQ = {
        rawNum: parseInt(qMatch[1], 10),
        text: qMatch[2].trim(),
        category: defaultCategory || "General",
        options: []
      };
      continue;
    }

    // 3. Check for OPTION START
    // Matches: "A. Goal state", "A) Goal state", "(A) Goal state", "[A] Goal state", "*A) Goal state", "A: Goal state"
    const optMatch = line.match(/^(?:[\*✓✔]?\s*(?:\(?\[?([A-Da-d])[\)\]\.\:\-]\s*)|\b([A-Da-d])\s*[\:\-]\s+)(.+)/i);
    if (optMatch && currentQ) {
      const optLetter = (optMatch[1] || optMatch[2]).toLowerCase();
      const optId = `opt_${optLetter}`;
      let optText = optMatch[3].trim();

      // Check if this option line contains an inline answer (e.g., "D. Evaluation state Answer: B. Initial state" or "D. State (Ans: B)")
      const inlineAnsMatch = optText.match(/\s+(?:Answer|Ans|Correct(?:\s*Answer)?|Key)\s*[\:\-\=\.]*\s*(?:Option)?\s*\(?\[?([A-Da-d1-4])\)?\]?(?:[\.\:\)\s\-]+.*)?$/i);
      if (inlineAnsMatch) {
        currentQ.correctAnswer = inlineAnsMatch[1].toUpperCase();
        optText = optText.substring(0, inlineAnsMatch.index).trim();
      }

      // Check if marked with asterisk or (Correct)
      if (/[\*✓✔]|\(correct\)|\[correct\]/i.test(line)) {
        currentQ.correctAnswer = optLetter.toUpperCase();
        optText = optText.replace(/\s*\(correct\)/i, "").replace(/\s*\[correct\]/i, "").trim();
      }
      
      // If option not yet recorded for this question, push it
      if (!currentQ.options.some(o => o.id === optId)) {
        currentQ.options.push({
          id: optId,
          text: optText
        });
      }
      continue;
    }

    // 4. Check for CATEGORY line: "Category: AI"
    const catMatch = line.match(/^Category\s*[\:\-]\s*(.+)/i);
    if (catMatch && currentQ) {
      currentQ.category = catMatch[1].trim();
      continue;
    }

    // 5. Check for POINTS line: "Points: 2" or "Marks: 2"
    const ptsMatch = line.match(/^(?:Points|Marks)\s*[\:\-]\s*(\d+)/i);
    if (ptsMatch && currentQ) {
      currentQ.points = parseInt(ptsMatch[1], 10);
      continue;
    }

    // 6. Handle continuation lines (Avoid appending answer lines or standalone "Answer:" to option text)
    if (/^(?:Answer|Ans|Key|Correct)\b/i.test(line)) {
      // Check if letter exists anywhere on this line
      const looseAnsMatch = line.match(/\b([A-Da-d])\b/);
      if (looseAnsMatch && currentQ) {
        currentQ.correctAnswer = looseAnsMatch[1].toUpperCase();
      }
      continue;
    }

    if (currentQ && currentQ.options.length === 0) {
      currentQ.text += " " + line;
    } else if (currentQ && currentQ.options.length > 0) {
      const lastOpt = currentQ.options[currentQ.options.length - 1];
      if (lastOpt) {
        lastOpt.text += " " + line;
      }
    }
  }

  // Push last question
  pushCurrentQuestion();

  return questions;
}
