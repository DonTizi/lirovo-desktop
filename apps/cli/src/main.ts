import { isLirovoError } from "@lirovo/contracts";
import { boolFlag, parseArgs } from "./args.js";
import { doctorCommand } from "./commands/doctor.js";
import { EXIT, type ExitCode } from "./exit-codes.js";

const HELP = `lirovo — local-first structured extraction for video

usage
  lirovo doctor [--json]        check dependencies, inference backends and paths

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
