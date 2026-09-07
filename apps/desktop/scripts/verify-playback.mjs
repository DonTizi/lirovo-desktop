import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { openDatabase, createSettingsStore } from "@lirovo/node-runtime";

const desktop = fileURLToPath(new URL("../", import.meta.url));
const scratch = await mkdtemp(path.join(tmpdir(), "lirovo-playback-check-"));
const data = path.join(scratch, "profile");
const run = path.join(data, "runs", "run_abc");
await mkdir(path.join(run, "normalized"), { recursive: true });
await mkdir(path.join(run, "source"), { recursive: true });
const bundled = path.join(desktop, "resources/bin/ffmpeg");
const ffmpeg = existsSync(bundled) ? bundled : "ffmpeg";
execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=0x303438:s=320x180:d=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(run, "normalized/video.mp4")]);
execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-ac", "1", "-ar", "16000", path.join(run, "normalized/audio.flac")]);
await writeFile(path.join(run, "source/manifest.json"), JSON.stringify({ duration_s: 6 }));
const db = openDatabase(path.join(data, "lirovo.db"));
try {
  createSettingsStore(db).set("onboarded", "1");
  db.prepare("INSERT INTO sources(id,kind,uri,title,duration_s,has_audio,has_video,created_at) VALUES ('source','file','fixture','Playback verification',6,1,1,1)").run();
  db.prepare("INSERT INTO runs(id,source_id,status,created_at) VALUES ('run_abc','source','succeeded',1)").run();
} finally { db.close(); }
const require = createRequire(import.meta.url);
const child = spawn(require("electron"), [path.join(desktop, "scripts/verify-playback.cjs")], {
  env: { ...process.env, LIROVO_DATA_DIR: data }, stdio: "inherit",
});
const timeout = setTimeout(() => child.kill("SIGKILL"), 45_000);
try {
  const [code, signal] = await once(child, "exit");
  if (code !== 0 || signal !== null) throw new Error(`Playback check failed (${code}, ${signal}); fixture retained at ${scratch}`);
  console.log(`Playback check passed; isolated fixture retained at ${scratch}`);
} finally { clearTimeout(timeout); }
