require("dotenv").config();

const fs = require("fs");
const { execSync } = require("child_process");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function analyze(code, file) {
  const prompt = `
You are a security code reviewer.

Check for:
- hardcoded secrets
- API keys
- passwords
- tokens

Respond ONLY in JSON:
{
  "safe": true/false,
  "reason": "",
  "fixedCode": ""
}

Code:
${code}
`;

  const res = await ai.models.generateContent({
    model: "gemini-1.0-pro",
    contents: prompt,
  });

  return JSON.parse(res.text);
}
