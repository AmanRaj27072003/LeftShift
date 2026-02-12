const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(process.cwd(), "index.js");

// ----------------------------
// 🔥 Detect auth vulnerabilities
// ----------------------------
function containsAuthIssue(code) {
  const patterns = [
    /SECRET_TOKEN\s*=\s*["']/,
    /req\.headers\[[^]]*\]/,
    /exec\(/,
    /res\.send\(\s*`/,
  ];

  return patterns.some(p => p.test(code));
}

// ----------------------------
// 🔥 Fix vulnerabilities
// ----------------------------
function fixAuthIssues(code) {
  return code
    // 🔐 move secret to env
    .replace(
      /const SECRET_TOKEN\s*=\s*["'][^"']+["']/,
      'const SECRET_TOKEN = process.env.SECRET_TOKEN'
    )

    // ❌ disable exec
    .replace(/exec\(/g, "// exec disabled\n// exec(")

    // ❌ XSS -> safe JSON
    .replace(
      /res\.send\(`([\s\S]*?)`\)/g,
      'res.json({ message: "Request received" })'
    )

    // ✅ add auth middleware once
    .replace(
      /const app = express\(\);/,
`const app = express();

const authMiddleware = (req,res,next)=>{
  const token = req.headers["x-api-token"];
  if(!token || token !== process.env.SECRET_TOKEN){
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};`
    );
}

// ----------------------------
// 🔥 MAIN (ONLY index.js)
// ----------------------------
(function main() {
  if (!fs.existsSync(TARGET_FILE)) {
    console.log("index.js not found");
    return;
  }

  const content = fs.readFileSync(TARGET_FILE, "utf8");

  if (!containsAuthIssue(content)) {
    console.log("✅ No auth issues found");
    process.exit(0);
  }

  console.log("🔐 Fixing auth issues in index.js");

  const updated = fixAuthIssues(content);

  fs.writeFileSync(TARGET_FILE, updated);

  console.log("✅ index.js updated");
  process.exit(0);
})();
