"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const storiesDir = path.join(root, "docs", "stories");
const audioDir = path.join(root, "docs", "audio");
const cacheDir = path.join(root, ".kokoro-cache");
const pythonBin = process.env.KOKORO_PYTHON || path.join(root, ".venv-kokoro", "bin", "python");
const renderer = path.join(__dirname, "kokoro-render.py");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");

function usage() {
  console.log("Usage: node scripts/generate-kokoro-audio.js [--force]");
  console.log("");
  console.log("Needs Kokoro installed in .venv.");
  console.log("Optional env vars:");
  console.log("  KOKORO_MOD_VOICE=am_puck");
  console.log("  KOKORO_PWINCESS_VOICE=af_heart");
  console.log("  KOKORO_PWINCESS_PITCH=1.32");
}

if (args.has("--help")) {
  usage();
  process.exit(0);
}

function loadStories() {
  global.REM_STORIES = [];
  for (const file of fs.readdirSync(storiesDir).filter((f) => f.endsWith(".js")).sort()) {
    require(path.join(storiesDir, file));
  }
  return global.REM_STORIES;
}

function cleanForVoice(text) {
  return text
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\bu\//g, "user ")
    .replace(/\br\//g, "are slash ")
    .replace(/_/g, " ")
    .replace(/\.\.\./g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function audioPath(storyId, lineIndex, speaker) {
  const file = `${String(lineIndex + 1).padStart(3, "0")}-${speaker}.wav`;
  return path.join(audioDir, storyId, file);
}

function buildManifest() {
  const items = [];
  for (const story of loadStories()) {
    for (let i = 0; i < story.lines.length; i += 1) {
      const line = story.lines[i];
      const speaker = line.speaker || "mod";
      const outputPath = audioPath(story.id, i, speaker);
      if (!force && fs.existsSync(outputPath)) continue;
      items.push({
        storyId: story.id,
        lineNumber: i + 1,
        speaker,
        text: cleanForVoice(line.text),
        outputPath,
      });
    }
  }
  return items;
}

function main() {
  if (!fs.existsSync(pythonBin)) {
    console.error(`Missing Python virtualenv at ${pythonBin}`);
    console.error("Create it with: python3.11 -m venv .venv-kokoro");
    process.exit(1);
  }

  const items = buildManifest();
  if (!items.length) {
    console.log("Done. All audio files already exist.");
    return;
  }

  fs.mkdirSync(audioDir, { recursive: true });
  const manifestPath = path.join(os.tmpdir(), `rem-sleep-kokoro-${Date.now()}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({ items }, null, 2));

  const result = childProcess.spawnSync(pythonBin, [renderer, manifestPath], {
    cwd: root,
    env: {
      ...process.env,
      HF_HOME: process.env.HF_HOME || cacheDir,
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || cacheDir,
    },
    stdio: "inherit",
  });
  fs.rmSync(manifestPath, { force: true });

  if (result.status !== 0) process.exit(result.status || 1);
}

main();
