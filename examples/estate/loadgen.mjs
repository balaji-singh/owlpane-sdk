// Steady traffic like a mobile app's users would generate: browse, open matches, sometimes pay.
const BFF = process.env.BFF_URL || "http://127.0.0.1:5100";
const pick = (n) => 1 + Math.floor(Math.random() * n);
async function visit(user) {
  const h = { "x-user-id": `usr_${user}` };
  await fetch(`${BFF}/api/matches`, { headers: h }).catch(() => {});
  for (let i = 0; i < 1 + (user % 3); i++) await fetch(`${BFF}/api/matches/${pick(60)}`, { headers: h }).catch(() => {});
  if (Math.random() < 0.3) await fetch(`${BFF}/api/checkout`, { method: "POST", headers: h }).catch(() => {});
}
console.log("load generator running against", BFF);
for (;;) { await visit(pick(40)); await new Promise((r) => setTimeout(r, 250 + Math.random() * 500)); }
