const fs = require("fs");
const path = require("path");
const https = require("https");

const AI_PROVIDER = process.env.AI_PROVIDER || "ollama";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TARGET_EXT = [".js"];

let issueFound = false;

function looksLikeAuthRisk(code) {
  const risky = [
    /\/admin/i,
    /delete/i,
    /update/i,
    /\/users\/:id/i,
  ];

  const hasAuth = /(authMiddleware|requireRole|isAdmin|jwt)/i;

  return risky.some(r => r.test(code)) && !hasAuth.test(code);
}

function callGemini(prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function callOllama(prompt) {
  const payload = JSON.stringify({
    model: OLLAMA_MODEL,
    prompt,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "host.docker.internal",
      port: 11434,
      path: "/api/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": payload.length
      }
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        resolve(JSON.parse(data).response);
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function refactor(code, filePath) {
  const prompt = `
You are a security engineer.

Fix authorization vulnerabilities:

Rules:
- Add authMiddleware to protected routes
- Add requireRole("admin") for admin routes
- Prevent IDOR by checking req.user.id === param id
- Do not change logic
- Return ONLY updated code

File: ${filePath}

Code:
${code}
`;

  if (AI_PROVIDER === "gemini") return await callGemini(prompt);
  return await callOllama(prompt);
}

async function processFile(file) {
  const content = fs.readFileSync(file, "utf8");

  if (!looksLikeAuthRisk(content)) return;

  console.log(`🔒 Authorization risk in ${file}`);
  issueFound = true;

  const updated = await refactor(content, file);

  if (updated) {
    fs.writeFileSync(file, updated);
    console.log(`✅ Secured ${file}`);
  }
}

async function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (f === "node_modules" || f.startsWith(".")) continue;

    const full = path.join(dir, f);

    if (fs.statSync(full).isDirectory()) await scan(full);
    else if (TARGET_EXT.includes(path.extname(f))) await processFile(full);
  }
}

(async () => {
  await scan(process.cwd());

  if (issueFound) {
    console.log("🔁 Authorization fixes applied. Re-run pipeline.");
    process.exit(1);
  }

  console.log("✅ Layer 4 passed: Authorization secure");
})();
