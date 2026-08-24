/**
 * Typed exit codes.
 *
 * A caller in a shell script, a Makefile or an agent harness branches on these,
 * so they are part of the public contract and only ever get appended to.
 */
export const EXIT = {
  ok: 0,
  failed: 1,
  usage: 2,
  unavailable: 3,
  cancelled: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
