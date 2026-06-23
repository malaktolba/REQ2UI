import Groq from "groq-sdk";
import { env } from "../config/env";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  retries = 3
): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: maxTokens,
      });
      const raw = completion.choices[0].message.content;
      if (!raw) throw new Error("Empty response from Groq");
      return JSON.parse(raw);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
      }
    }
  }
  throw lastError;
}

/** Like callGroq but returns raw text — used when the model output is not JSON (e.g. HTML). */
export async function callGroqText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  retries = 3
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
      });
      const raw = completion.choices[0].message.content;
      if (!raw) throw new Error("Empty response from Groq");
      // Strip markdown code fences if present
      return raw.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
      }
    }
  }
  throw lastError as any;
}
