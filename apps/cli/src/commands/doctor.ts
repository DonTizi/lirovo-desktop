import type { AsrStrategy } from "@lirovo/contracts";
import { DEPENDENCIES, runDoctor, type DoctorReport } from "@lirovo/core";
import { buildBackends, makeBinaryProbe, realExec, resolvePaths } from "@lirovo/node-runtime";
import { EXIT, type ExitCode } from "../exit-codes.js";

const TICK = "ok  ";
const CROSS = "FAIL";
const WARN = "warn";

const pad = (s: string, n: number): string => s.padEnd(n, " ");

export const renderReport = (report: DoctorReport): string => {
  const lines: string[] = [];

  lines.push("paths");
  lines.push(`  data    ${report.paths.data}`);
  lines.push(`  runs    ${report.paths.runs}`);
  lines.push(`  models  ${report.paths.models}`);
  lines.push(`  db      ${report.paths.dbFile}`);
  lines.push("");

  lines.push("dependencies");
  for (const dep of report.dependencies) {
    const mark = dep.found ? TICK : dep.required ? CROSS : WARN;
    const where = dep.found ? `${dep.version ?? "?"}  (${dep.origin})  ${dep.path}` : `not found — ${dep.why}`;
    lines.push(`  ${mark}  ${pad(dep.id, 12)} ${where}`);
  }
  lines.push("");

  lines.push("inference backends");
  for (const backend of report.backends) {
    const mark = backend.available ? TICK : WARN;
    const notes: string[] = [];
    if (backend.nativeJsonSchema) notes.push("native json-schema");
    if (!backend.images) notes.push("text only");
    if (backend.spawnsProcessPerCall) notes.push("spawns per call");
    const detail = backend.available ? (backend.version ?? "") : (backend.reason ?? "unavailable");
    lines.push(`  ${mark}  ${pad(backend.id, 12)} ${detail}${notes.length > 0 ? `  [${notes.join(", ")}]` : ""}`);
  }
  lines.push("");

  lines.push("transcription");
  if (report.asrStrategies.length === 0) lines.push("  none");
  else for (const name of report.asrStrategies) lines.push(`  ${TICK}  ${name}`);

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("warnings");
    for (const w of report.warnings) lines.push(`  ${WARN}  ${w}`);
  }
  if (report.problems.length > 0) {
    lines.push("");
    lines.push("problems");
    for (const p of report.problems) lines.push(`  ${CROSS}  ${p}`);
  }

  lines.push("");
  lines.push(report.ok ? "ready" : "not ready");
  return lines.join("\n");
};

export interface DoctorOptions {
  readonly json: boolean;
  readonly asrStrategies?: readonly AsrStrategy[];
}

export const doctorCommand = async (
  opts: DoctorOptions,
  stdout: (s: string) => void,
): Promise<ExitCode> => {
  const paths = resolvePaths();
  const report = await runDoctor({
    paths,
    dependencies: DEPENDENCIES,
    probeBinary: makeBinaryProbe(paths, realExec),
    backends: buildBackends({ exec: realExec, paths }),
    asrStrategies: opts.asrStrategies ?? [],
  });

  stdout(opts.json ? JSON.stringify(report, null, 2) : renderReport(report));
  return report.ok ? EXIT.ok : EXIT.unavailable;
};
