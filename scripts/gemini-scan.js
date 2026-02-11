require("dotenv").config();
const fs = require("fs");
const { execSync } = require("child_process");
const { GoogleGenAI } = require("@google/genai");

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro"});

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

  const res = await model.generateContent(prompt);
  return JSON.parse(res.response.text());
}

async function main() {
  const changedFiles = execSync(
    "git diff --name-only origin/main...HEAD"
  ).toString().split("\n");

  let failed = false;

  for (const file of changedFiles) {
    if (!file.endsWith(".js")) continue;
    if (!fs.existsSync(file)) continue;

    const code = fs.readFileSync(file, "utf8");

    console.log(`🔍 Scanning ${file}...`);

    const result = await analyze(code, file);

    if (!result.safe) {
      failed = true;

      console.log(`\n🚨 Security issue in ${file}`);
      console.log("Reason:", result.reason);
      console.log("\nSuggested Fix:\n", result.fixedCode);
    }
  }

  if (failed) {
    console.error("\n❌ Layer 1 failed: Security issues detected");
    process.exit(1);
  }

  console.log("\n✅ Layer 1 passed: No hardcoded secrets");
}

main();
