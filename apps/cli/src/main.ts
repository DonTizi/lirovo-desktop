import { isLirovoError } from "@lirovo/contracts";
import { boolFlag, parseArgs } from "./args.js";
import { doctorCommand } from "./commands/doctor.js";
import { DEFAULT_FRAME_CAP, extractCommand } from "./commands/extract.js";
import { EXIT, type ExitCode } from "./exit-codes.js";

const HELP = `lirovo — local-first structured extraction for video

usage
  lirovo doctor [--json]                    check dependencies, backends and paths
  lirovo extract <url|file> --schema <f>     transcribe, build the graph and fill
                                            the schema, with evidence per value
  lirovo extract <url|file> --no-inference   the media and transcription half only

extract flags
  --schema <file.json>          JSON Schema the extraction must conform to
  --backend <id>                force an inference backend (default: first available)
  --model <name>                model the backend should use
  --effort <low|medium|high>    reasoning effort (default low — frame description
                                is perception, not reasoning)
  --time-budget <minutes>       wall-clock ceiling for describing frames
                                (default 15). Over budget, frames are chosen to
                                cover the whole video rather than truncated.
  --concurrency <n>             vision sessions in flight (default 4)
  --resume <run_id>             continue an interrupted run, reusing every stage
                                that finished on the same inputs
  --no-inference                skip the model stages entirely
  --frame-cap <n>               refuse a source yielding more scene changes
                                (default ${DEFAULT_FRAME_CAP})

global flags
  --json                        machine-readable output on stdout
  -h, --help                    this text

exit codes
  0  ok        2  usage error      130  cancelled
  1  failed    3  unavailable (a required backend or dependency is missing)
`;

export const main = async (argv: readonly string[]): Promise<void> => {
  const args = parseArgs(argv);
  const json = boolFlag(args, "json");

  // Progress and diagnostics go to stderr so `--json` stdout stays parseable
  // even when the command is chatty.
  const out = (s: string): void => {
    process.stdout.write(`${s}\n`);
  };
  const errOut = (s: string): void => {
    process.stderr.write(`${s}\n`);
  };

  if (boolFlag(args, "help") || boolFlag(args, "h") || args.command === null || args.command === "help") {
    out(HELP);
    process.exitCode = args.command === null && !boolFlag(args, "help") && !boolFlag(args, "h") ? EXIT.usage : EXIT.ok;
    return;
  }

  let code: ExitCode = EXIT.ok;
  try {
    switch (args.command) {
      case "doctor":
        code = await doctorCommand({ json }, out);
        break;
      case "extract": {
        const source = args.positionals[0];
        if (source === undefined) {
          errOut("extract needs a URL or a file path\n");
          errOut(HELP);
          code = EXIT.usage;
          break;
        }
        const schemaFlag = args.flags["schema"];
        const schemaPath = typeof schemaFlag === "string" ? schemaFlag : null;
        // Without a schema there is nothing for the model to fill in, so the
        // media half runs on its own rather than the command refusing.
        if (schemaPath === null && !boolFlag(args, "no-inference")) {
          errOut("extract needs --schema <file.json>, or --no-inference to run the media and transcription half alone");
          code = EXIT.usage;
          break;
        }
        const backendFlag = args.flags["backend"];
        const modelFlag = args.flags["model"];
        const budgetFlag = args.flags["time-budget"];
        const concFlag = args.flags["concurrency"];
        const resumeFlag = args.flags["resume"];
        const visionBudgetS = typeof budgetFlag === "string" ? Number(budgetFlag) * 60 : 15 * 60;
        if (!Number.isFinite(visionBudgetS) || visionBudgetS <= 0) {
          errOut(`--time-budget must be a positive number of minutes, got "${String(budgetFlag)}"`);
          code = EXIT.usage;
          break;
        }
        const effortFlag = args.flags["effort"];
        if (effortFlag !== undefined && !["low", "medium", "high"].includes(String(effortFlag))) {
          errOut(`--effort must be low, medium or high, got "${String(effortFlag)}"`);
          code = EXIT.usage;
          break;
        }
        const rawCap = args.flags["frame-cap"];
        const frameCap = typeof rawCap === "string" ? Number(rawCap) : DEFAULT_FRAME_CAP;
        if (!Number.isFinite(frameCap) || frameCap <= 0) {
          errOut(`--frame-cap must be a positive number, got "${String(rawCap)}"`);
          code = EXIT.usage;
          break;
        }
        code = await extractCommand(
          {
            source,
            json,
            frameCap,
            schemaPath,
            backendId: typeof backendFlag === "string" ? backendFlag : null,
            model: typeof modelFlag === "string" ? modelFlag : null,
            effort: typeof effortFlag === "string" ? (effortFlag as "low" | "medium" | "high") : null,
            visionBudgetS,
            concurrency: typeof concFlag === "string" ? Number(concFlag) : null,
            resumeRunId: typeof resumeFlag === "string" ? resumeFlag : null,
          },
          out,
          errOut,
        );
        break;
      }
      default:
        errOut(`unknown command "${args.command}"\n`);
        errOut(HELP);
        code = EXIT.usage;
    }
  } catch (error) {
    const payload = isLirovoError(error)
      ? error.toJSON()
      : { code: "INTERNAL", message: error instanceof Error ? error.message : String(error), context: {} };
    if (json) out(JSON.stringify({ ok: false, error: payload }, null, 2));
    else errOut(`${payload.code}: ${payload.message}`);
    code = payload.code === "CANCELLED" ? EXIT.cancelled : EXIT.failed;
  }

  process.exitCode = code;
};
