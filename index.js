const express = require("express");
const app = express();

const authMiddleware = (req,res,next)=>{
  const token = req.headers["x-api-token"];
  if(!token || token !== process.env.SECRET_TOKEN){
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

app.use(express.json());

// ❌ Hardcoded secret
const SECRET_TOKEN = process.env.SECRET_TOKEN;


// =====================================================
// ❌ 1️⃣ SQL Injection
// =====================================================
app.get("/user", (req, res) => {
  const username = req.query.username;

  const query = `SELECT * FROM users WHERE username = '${username}'`;

  res.json({ message: "Query executed", query });
});


// =====================================================
// ❌ 2️⃣ XSS
// =====================================================
app.get("/welcome", (req, res) => {
  const name = req.query.name;

  res.json({ message: "Request received" });
});


// =====================================================
// ❌ 3️⃣ Command Injection
// =====================================================
const { exec } = require("child_process");

app.get("/ping", (req, res) => {
  const host = req.query.host;

  // exec disabled
// exec(`ping -c 1 ${host}`, (err, stdout, stderr) => {
    if (err) return res.status(500).send(stderr);
    res.send(stdout);
  });
});


// =====================================================
// 🔥 NEW AUTH VULNERABILITIES FOR LAYER 4
// =====================================================


// ❌ 4️⃣ Admin panel WITHOUT authentication
app.get("/admin", (req, res) => {
  res.json({
    secret: "All users data",
    message: "Admin dashboard"
  });
});


// ❌ 5️⃣ Role controlled by client input
app.get("/settings", (req, res) => {
  const isAdmin = req.query.isAdmin; // DANGEROUS

  if (isAdmin === "true") {
    return res.json({ message: "Admin settings accessed" });
  }

  res.json({ message: "User settings" });
});


// ❌ 6️⃣ IDOR – no ownership validation
app.get("/users/:id", (req, res) => {
  const id = req.params.id;

  // Anyone can access anyone’s data
  res.json({
    id,
    email: "private@email.com",
    salary: 100000
  });
});


// ❌ 7️⃣ Delete user WITHOUT auth
app.delete("/delete-user/:id", (req, res) => {
  const id = req.params.id;

  res.json({
    message: `User ${id} deleted`
  });
});


// ❌ 8️⃣ Trusting client provided userId
app.post("/transfer", (req, res) => {
  const { fromUserId, toUserId, amount } = req.body;

  res.json({
    message: `Transferred ${amount} from ${fromUserId} to ${toUserId}`
  });
});


// =====================================================
// Existing secure endpoint (still bad secret)
// =====================================================
app.get("/secure", (req, res) => {
  const token = req.headers["x-api-token"];

  if (token !== SECRET_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({ message: "Secure data accessed" });
});


app.listen(3000, () => {
  console.log("Server running on port 3000");
});
