import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const findings = [];
const patterns = [
  ["absolute home-directory path", /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/g],
  ["Sites deployment identifier", /\bappgprj_[A-Za-z0-9_-]+\b/g],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["Telegram bot token", /\b\d{6,12}:[A-Za-z0-9_-]{25,}\b/g],
  ["OpenAI-style API key", /\bsk-(?:or-v1-)?[A-Za-z0-9_-]{24,}\b/g],
];

for (const file of trackedFiles) {
  if (!existsSync(file)) continue;
  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue;
  const text = buffer.toString("utf8");

  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
}

const hosting = JSON.parse(readFileSync(".openai/hosting.json", "utf8"));
if ("project_id" in hosting) findings.push(".openai/hosting.json: must not contain a deployment-specific project_id");

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.name !== "openchat") findings.push("package.json: package name must remain the neutral public name 'openchat'");

if (findings.length) {
  console.error("Public-release check failed:\n");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Public-release check passed for ${trackedFiles.length} publishable files.`);
