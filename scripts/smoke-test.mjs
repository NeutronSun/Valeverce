import { readFile } from "node:fs/promises";
import path from "node:path";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../src/shared/events.js";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function valuesEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertSameValues(label, left, right) {
  assert(
    valuesEqual(left, right),
    `${label} mismatch:\nleft: ${left.join(", ")}\nright: ${right.join(", ")}`
  );
}

function extractDocEvents(contract, heading) {
  const nextHeadingIndex = contract.indexOf("\n## ", contract.indexOf(heading) + heading.length);
  const endIndex = nextHeadingIndex === -1 ? contract.length : nextHeadingIndex;
  const section = contract.slice(contract.indexOf(heading), endIndex);
  return [...section.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
}

function extractTsEventValues(source, constantName) {
  const startIndex = source.indexOf(`const ${constantName} = {`);
  assert(startIndex !== -1, `Missing ${constantName} in src/shared/events.ts`);
  const blockStart = source.slice(startIndex);
  const endIndex = blockStart.indexOf("} as const");
  assert(endIndex !== -1, `Missing ${constantName} closing block in src/shared/events.ts`);
  return [...blockStart.slice(0, endIndex).matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
}

const cardsPath = path.join(root, "public/data/cards.json");
const cardsData = JSON.parse(await readFile(cardsPath, "utf8"));
const cards = Array.isArray(cardsData) ? cardsData : cardsData.cards;

assert(Array.isArray(cards), "public/data/cards.json must expose a cards array");
assert(cards.length > 0, "public/data/cards.json must contain cards");

const socketContract = await readFile(path.join(root, "docs/socket-contract.md"), "utf8");
const eventsTs = await readFile(path.join(root, "src/shared/events.ts"), "utf8");

const docClientEvents = extractDocEvents(socketContract, "## Public client events");
const docServerEvents = extractDocEvents(socketContract, "## Public server events");
const jsClientEvents = Object.values(CLIENT_EVENTS);
const jsServerEvents = Object.values(SERVER_EVENTS);
const tsClientEvents = extractTsEventValues(eventsTs, "CLIENT_EVENTS_DATA");
const tsServerEvents = extractTsEventValues(eventsTs, "SERVER_EVENTS_DATA");

assertSameValues("Client events docs/js", docClientEvents, jsClientEvents);
assertSameValues("Server events docs/js", docServerEvents, jsServerEvents);
assertSameValues("Client events js/ts", jsClientEvents, tsClientEvents);
assertSameValues("Server events js/ts", jsServerEvents, tsServerEvents);

console.log("Smoke checks passed.");
