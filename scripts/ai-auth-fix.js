const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const TARGET_EXT = [".js"];

// ----------------------------
// 🔥 get ONLY changed files in PR
// ----------------------------
function getChangedFiles() {
  try {
    const output = execSync(
      "git diff --name-only origin/${GITHUB_BASE_REF:-main}...HEAD",
      { encoding: "utf8" }
    );

    return output
      .split("\n")
      .filter(f => TARGET_EXT.includes(path.extname(f)));
  } catch {
    return ["index.js"]; // fallback
  }
}

// ----------------------------
// 🔥 Detect auth vulnerabilities
// ----------------------------
function containsAuthIssue(code) {
  const patterns = [
    /SECRET_TOKEN\s*=\s*["']/,
    /req\.headers\[[^]]*\]/,
    /if\s*\(\s*token\s*!==/,
    /exec\(/,
    /res\.send\(\s*`/,
  ];

  return patterns.some(p => p.test(code));
}

// ----------------------------
// 🔥 Simple local auto-fix (no new files)
// ----------------------------
function fixAuthIssues(code) {
  return code
    // remove hardcoded secret
    .replace(
      /const SECRET_TOKEN\s*=\s*["'][^"']+["']/,
      'const SECRET_TOKEN = process.env.SECRET_TOKEN'
    )

    // escape XSS
    .replace(
      /res\.send\(`([\s\S]*?)\$\{name\}([\s\S]*?)`\)/,
      'res.json({ message: `Welcome ${name}` })'
    )

    // block command injection
    .replace(/exec\(/g, "// exec disabled for security\n// exec(")

    // add simple middleware
    .replace(
      /const app = express\(\);/,
      `const app = express();

const authMiddleware = (req,res,next)=>{
  const token = req.headers["x-api-token"];
  if(token !== process.env.SECRET_TOKEN){
    return res.status(401).json({error:"Unauthorized"});
  }
  next();
};`
    );
}

// ----------------------------
// 🔥 MAIN
// ----------------------------
(async () => {
  const files = getChangedFiles();
  let modified = false;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");

    if (!containsAuthIssue(content)) continue;

    console.log("🔐 Fixing auth issues in:", file);

    const updated = fixAuthIssues(content);

    fs.writeFileSync(file, updated); // ✅ overwrite same file
    modified = true;
  }

  if (!modified) {
    console.log("✅ No auth issues found");
    process.exit(0);
  }

  console.log("🔁 Files updated. Commit will happen.");
  process.exit(1);
})();
