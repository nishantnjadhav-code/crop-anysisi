import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const bodyStr = buffer.toString("binary");

      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) {
        reject(new Error("No boundary found in Content-Type"));
        return;
      }
      const boundary = boundaryMatch[1].trim();

      const fields = {};
      let imageBase64 = null;
      let imageMimeType = "image/jpeg";

      const parts = bodyStr.split("--" + boundary);
      for (const part of parts) {
        if (!part || part.startsWith("--") || part.trim() === "") continue;

        const separatorIndex = part.indexOf("\r\n\r\n");
        if (separatorIndex === -1) continue;

        const rawHeaders = part.substring(0, separatorIndex);
        // Remove trailing \r\n from body
        const body = part.substring(separatorIndex + 4).replace(/\r\n$/, "");

        const nameMatch = rawHeaders.match(/name="([^"]+)"/);
        const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
        const contentTypeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);

        if (!nameMatch) continue;
        const fieldName = nameMatch[1];

        if (filenameMatch) {
          imageMimeType = contentTypeMatch
            ? contentTypeMatch[1].trim()
            : "image/jpeg";
          imageBase64 = Buffer.from(body, "binary").toString("base64");
        } else {
          fields[fieldName] = body;
        }
      }

      resolve({ fields, imageBase64, imageMimeType });
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "AI analysis is currently unavailable. Please try again.",
    });
  }

  let fields, imageBase64, imageMimeType;
  try {
    ({ fields, imageBase64, imageMimeType } = await parseFormData(req));
  } catch (err) {
    console.error("Form parse error:", err);
    return res.status(400).json({ error: "Failed to parse image upload." });
  }

  if (!imageBase64) {
    return res.status(400).json({ error: "No image provided." });
  }

  const selectedCrop = fields.crop || "";
  const region = fields.region || "";
  const language = fields.language || "English";

  const languageInstructions = {
    English: "Respond entirely in English.",
    Hindi:
      "Respond entirely in Hindi (हिंदी). All values inside the JSON must be written in Hindi script.",
    Marathi:
      "Respond entirely in Marathi (मराठी). All values inside the JSON must be written in Marathi script.",
  };

  const langInstruction =
    languageInstructions[language] || languageInstructions["English"];

  const systemPrompt = `You are AgriSense AI, an expert agricultural image analyst helping farmers in India and worldwide.
Your role is to analyze crop and plant images and provide structured, practical, safe agricultural guidance.

CRITICAL SAFETY RULES — follow these without exception:
1. Never claim 100% certainty. Always express confidence as a range.
2. If the image is blurry, too dark, too close, or unclear — state the image is insufficient, ask for a clearer photo. Do NOT invent a disease.
3. If you cannot reliably identify the plant or disease — say "Unable to determine from this image" and give only general observations. Do NOT fabricate a diagnosis.
4. Never invent exact fertilizer quantities, pesticide doses, chemical concentrations, or treatment schedules. Give general practical guidance and recommend consulting local agricultural experts or guidelines for exact dosage.
5. Always recommend consulting a local agricultural expert for critical decisions.

FARMER-PROVIDED CONTEXT:
- Crop/plant selected by farmer: ${selectedCrop || "Not specified"}
- Farmer's region/location: ${region || "Not specified"}
- Response language requested: ${language}

LANGUAGE INSTRUCTION: ${langInstruction}

Analyze the uploaded plant/crop image and return ONLY a valid JSON object with no markdown fences, no explanation outside the JSON. Use exactly this structure:

{
  "plant": "Identified plant or crop name. If unclear, say 'Unable to determine from this image'.",
  "condition": "Brief name of the identified condition, disease, or 'Appears Healthy', or 'Unable to determine'.",
  "confidence": "Confidence range e.g. '70–80%' with a note that this is an AI estimate only.",
  "health_status": "One of exactly: Healthy / Mild Concern / Moderate Concern / Severe / Unable to Determine",
  "what_happened": "2–4 sentence plain-language explanation of what is happening with this plant. If image is unclear, say so clearly and ask for a better photo.",
  "possible_causes": ["Cause 1", "Cause 2"],
  "symptoms": ["Visible symptom observed in the image 1", "Symptom 2"],
  "treatment": ["Practical treatment step 1 — no exact chemical doses", "Step 2", "Consult a local agricultural expert for exact dosage and chemical selection"],
  "fertilizer_guidance": ["General fertilizer tip 1", "General tip 2", "Consult local agricultural guidelines for exact quantities"],
  "irrigation_guidance": ["Irrigation guidance 1", "Guidance 2"],
  "prevention": ["Prevention measure 1", "Prevention measure 2"],
  "monitoring": "What the farmer should observe over what timeframe to assess progress or improvement.",
  "language": "${language}"
}

Consider the farmer's region (${region || "unspecified"}) for agricultural context where relevant.
Return ONLY the JSON object. No markdown. No text before or after.`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
     model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType,
                data: imageBase64,
              },
            },
            {
              text: systemPrompt,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    let rawText = (response.text || "").trim();

    // Strip markdown code fences if model wraps output anyway
    rawText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("JSON parse failed. Raw text:", rawText);
      return res.status(502).json({
        error: "AI analysis is currently unavailable. Please try again.",
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Gemini API error:", err?.message || err);
    return res.status(503).json({
      error: "AI analysis is currently unavailable. Please try again.",
    });
  }
}
