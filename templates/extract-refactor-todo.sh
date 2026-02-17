#!/usr/bin/env bash
# Extracts a machine-readable refactor TODO list from an AI review markdown file.
# Usage: extract-refactor-todo.sh <review.md> <output.json>
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <review.md> <output.json>" >&2
  exit 1
fi

REVIEW_FILE="$1"
OUTPUT_FILE="$2"

if [[ ! -f "$REVIEW_FILE" ]]; then
  echo "Review file not found: $REVIEW_FILE" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for extract-refactor-todo.sh" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"

node - "$REVIEW_FILE" "$OUTPUT_FILE" <<'NODE'
const fs = require("fs");

const [reviewPath, outputPath] = process.argv.slice(2);
const content = fs.readFileSync(reviewPath, "utf8");
const lines = content.split(/\r?\n/);

const items = [];
let currentChunk = "global";

const matchers = [
  /^-\s+\[FAIL\]\s+\*\*(.+?)\*\*:\s*-(\d+)\s+--\s+(.+)$/,
  /^-\s*❌\s*\*\*(.+?)\*\*:\s*-(\d+)\s+[—-]\s+(.+)$/,
  /^-\s*\*\*(.+?)\*\*:\s*-(\d+)\s+[—-]\s+(.+)$/,
];

for (const rawLine of lines) {
  const line = rawLine.trim();
  const chunkMatch = line.match(/^##\s+Chunk:\s+(.+)$/i);
  if (chunkMatch) {
    currentChunk = chunkMatch[1].trim();
    continue;
  }

  let matched = null;
  for (const regex of matchers) {
    const m = line.match(regex);
    if (m) {
      matched = m;
      break;
    }
  }
  if (!matched) {
    continue;
  }

  const point = String(matched[1] || "Unknown").trim();
  const minus = Number(matched[2] || 0);
  const reason = String(matched[3] || "").trim();

  const index = items.length + 1;
  const normalizedChunk = currentChunk.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "global";
  const normalizedPoint = point.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "finding";

  items.push({
    id: `${normalizedChunk}-${normalizedPoint}-${index}`,
    status: "todo",
    chunk: currentChunk,
    point,
    minus,
    reason,
    title: `[${currentChunk}] ${point} (-${minus})`,
  });
}

const payload = {
  kind: "refactor-todo",
  sourceReview: reviewPath,
  generatedAt: new Date().toISOString(),
  totalItems: items.length,
  items,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
NODE

echo "Refactor TODO extracted: $OUTPUT_FILE"
