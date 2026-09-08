import type { QuizQuestion } from "../types/quiz";
import { parseQuestionsFromText } from "./pdfExtractor";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Supported Google AI Studio / Gemini models in priority order
const GEMINI_MODELS = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash-exp",
  "gemini-pro"
];

interface GeminiQuestionOutput {
  questionNumber?: number;
  text: string;
  points?: number;
  category?: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
}

/**
 * Extracts and accurately marks questions using Google AI Studio (Gemini).
 * If Gemini fails or API key is not configured, falls back to local regex extraction.
 */
export async function extractQuizQuestionsWithGemini(
  rawText: string,
  targetCategory: string = "General"
): Promise<{ questions: QuizQuestion[]; usedAI: boolean; error?: string }> {
  if (!rawText || !rawText.trim()) {
    return { questions: [], usedAI: false };
  }

  const apiKey = GEMINI_API_KEY.trim();

  // If no Gemini API key configured, use local parser
  if (!apiKey || apiKey === "your_google_ai_studio_gemini_api_key") {
    const localResult = parseQuestionsFromText(rawText, targetCategory);
    return { questions: localResult, usedAI: false };
  }

  // Attempt extraction via Gemini models
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `You are an expert exam scanner and academic question parser.
Analyze the following text extracted from a quiz or exam document (e.g. PDF or document text).

TASK:
1. Extract ALL multiple choice questions (MCQs) present in the text without skipping any.
2. For each question, extract:
   - "questionNumber": sequential integer starting from 1
   - "text": the complete question text (without the leading number)
   - "points": points for this question (default 2 if not stated)
   - "category": "${targetCategory}"
   - "options": exactly 4 option objects with IDs "opt_a", "opt_b", "opt_c", "opt_d" and their respective text
   - "correctOptionId": the ID of the correct option ("opt_a", "opt_b", "opt_c", or "opt_d"). 
     CRITICAL: Determine the correct answer from:
     a) Explicit answer markings like "Answer: A", "Ans: B", "Key: C", "Correct: Option D"
     b) Asterisks or checks on options like "*A)" or "(Correct)"
     c) End-of-document Answer Key lists
     d) If unmarked, solve the question accurately using expert domain knowledge.

Return ONLY a strict JSON array of question objects adhering to this schema:
[
  {
    "questionNumber": 1,
    "text": "Question text here?",
    "points": 2,
    "category": "${targetCategory}",
    "options": [
      { "id": "opt_a", "text": "First option" },
      { "id": "opt_b", "text": "Second option" },
      { "id": "opt_c", "text": "Third option" },
      { "id": "opt_d", "text": "Fourth option" }
    ],
    "correctOptionId": "opt_a"
  }
]

RAW DOCUMENT TEXT TO PARSE:
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
        continue; // Try next model or fallback quietly
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

      const parsedJson: GeminiQuestionOutput[] = JSON.parse(cleanJson);

      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        const formatted: QuizQuestion[] = parsedJson.map((item, idx) => {
          const qNum = idx + 1;
          const optionsList = Array.isArray(item.options) ? item.options : [];
          
          // Normalize options to opt_a, opt_b, opt_c, opt_d
          const optionIds = ["opt_a", "opt_b", "opt_c", "opt_d"];
          const normalizedOptions = optionIds.map((optId, oIdx) => {
            const existing = optionsList.find(o => 
              o.id?.toLowerCase() === optId || 
              o.id?.toLowerCase() === `opt_${String.fromCharCode(97 + oIdx)}`
            ) || optionsList[oIdx];

            return {
              id: optId,
              text: (existing?.text || `Option ${oIdx + 1}`).trim()
            };
          });

          // Normalize correct option ID
          let correctId = "opt_a";
          if (item.correctOptionId) {
            const cid = item.correctOptionId.toLowerCase();
            if (cid.includes("b") || cid === "2") correctId = "opt_b";
            else if (cid.includes("c") || cid === "3") correctId = "opt_c";
            else if (cid.includes("d") || cid === "4") correctId = "opt_d";
            else if (cid.includes("a") || cid === "1") correctId = "opt_a";
          }

          return {
            id: `q_${Date.now()}_${qNum}_${Math.random().toString(36).substr(2, 4)}`,
            questionNumber: qNum,
            text: (item.text || "").trim(),
            points: item.points || 2,
            category: item.category || targetCategory || "General",
            options: normalizedOptions,
            correctOptionId: correctId
          };
        });

        return { questions: formatted, usedAI: true };
      }
    } catch (err) {
      console.warn(`Error during Gemini extraction with model ${model}:`, err);
    }
  }

  // Fallback to local regex extractor
  console.log("Falling back to local pattern-based parser");
  const localResult = parseQuestionsFromText(rawText, targetCategory);
  return { questions: localResult, usedAI: false };
}
