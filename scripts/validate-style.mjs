import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set(["node_modules", ".next", "dist", "build", ".git", "coverage"]);
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);

const issues = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...await walk(fullPath));
      }
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file);
}

function report(file, message) {
  issues.push(`${relative(file)}: ${message}`);
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

const files = await walk(root);

for (const file of files) {
  const rel = relative(file);
  const text = await readFile(file, "utf8");

  if (/\bvar\s+/.test(text)) {
    report(file, "avoid `var`; use const/let");
  }

  if (/#\w+/.test(text)) {
    report(file, "avoid #private fields; use normal fields/conventions");
  }

  if (/\.then\s*\(/.test(text) && !/Promise\.all/.test(text)) {
    report(file, "prefer async/await over .then chains when possible");
  }

  if (/class\s+Utils\b|class\s+Helpers\b|export\s+class\s+Utils\b|export\s+class\s+Helpers\b/.test(text)) {
    report(file, "avoid generic mega Utils/Helpers classes; use contextual utility modules/classes");
  }

  if (/helpers\.(js|ts|mjs)$|utils\.(js|ts|mjs)$/.test(rel.replaceAll("\\", "/"))) {
    const functionCount = countMatches(text, /\bfunction\s+\w+\s*\(/g) + countMatches(text, /export\s+function\s+\w+\s*\(/g);
    if (functionCount > 8) {
      report(file, "large generic helpers/utils file detected; split by context");
    }
  }

  if (/src[\\/]server\.(js|ts|mjs)$/.test(rel)) {
    const forbidden = ["function draftCard", "function selectCard", "function submitPlan", "function resolveRound"];
    for (const pattern of forbidden) {
      if (text.includes(pattern)) {
        report(file, `server entrypoint still contains game logic: ${pattern}`);
      }
    }
  }

  if (/src[\\/]game\.(js|ts|mjs)$/.test(rel)) {
    const functionCount = countMatches(text, /\bexport\s+function\s+\w+\s*\(/g);
    if (functionCount > 16) {
      report(file, "`game.js` is still a large logic file; target is barrel/export compatibility only");
    }
  }

  if (/if\s*\(\s*mode\s*={2,3}\s*["']/.test(text) || /if\s*\(\s*\w+\.modeId\s*={2,3}\s*["']/.test(text)) {
    report(file, "avoid scattered mode checks; use GameMode/systems composition");
  }
}

if (issues.length) {
  console.error("Style validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Style validation passed.");
