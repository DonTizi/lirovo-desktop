/**
 * A small argument parser.
 *
 * Hand-rolled rather than pulled from npm: the surface is a handful of long
 * flags, and a dependency here would be the only thing standing between the CLI
 * and a zero-dependency install.
 */
export interface ParsedArgs {
  readonly command: string | null;
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) continue;
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    const name = token.replace(/^--?/, "");
    const eq = name.indexOf("=");
    if (eq !== -1) {
      flags[name.slice(0, eq)] = name.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      flags[name] = next;
      i += 1;
    } else {
      flags[name] = true;
    }
  }

  const [command = null, ...rest] = positionals;
  return { command, positionals: rest, flags };
};

export const boolFlag = (args: ParsedArgs, name: string): boolean => args.flags[name] === true;
