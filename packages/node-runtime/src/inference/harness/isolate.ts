import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The environment an agent CLI is allowed to see.
 *
 * A coding agent is not an inference runtime: it is a process with ambient
 * authority. A transcript, and the OCR text of a slide, are untrusted input, so
 * a prompt injection inside a video can ask the agent to read a file and echo
 * it back inside an extracted field.
 *
 * Replacing the environment closes the easiest exfiltration path — no
 * `AWS_*`, no unrelated `*_API_KEY`, no `GITHUB_TOKEN`.
 *
 * It does NOT close the hardest one. `HOME` has to stay: the agent reads its
 * own OAuth credentials from there, so anything else under `HOME` remains
 * readable if the agent still has a file-reading tool. Disabling its tools is
 * the second layer; an OS sandbox that limits which files the process can open
 * at all is the third, and until that exists this path stays labelled
 * experimental.
 */
export const minimalEnv = (env: NodeJS.ProcessEnv = process.env): Record<string, string> => {
  const keep = ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SHELL", "USER"];
  const out: Record<string, string> = {};
  for (const key of keep) {
    const value = env[key];
    if (value !== undefined) out[key] = value;
  }
  // Agent CLIs are chattier and slower when they think a human is watching.
  out["CI"] = "1";
  out["NO_COLOR"] = "1";
  return out;
};

export interface Sandbox {
  readonly dir: string;
  /** Write a file the agent may read (a JSON Schema, for instance). */
  file(name: string, contents: string): Promise<string>;
  dispose(): Promise<void>;
}

/**
 * A disposable empty working directory.
 *
 * Empty matters: an agent launched inside the user's project picks up its
 * rules files, its git history and its neighbours. Launched in an empty temp
 * directory it has nothing local to read and nothing local to leak.
 */
export const createSandbox = async (): Promise<Sandbox> => {
  const dir = await mkdtemp(path.join(tmpdir(), "lirovo-harness-"));
  return {
    dir,
    async file(name, contents) {
      const target = path.join(dir, name);
      await writeFile(target, contents, "utf8");
      return target;
    },
    async dispose() {
      await rm(dir, { recursive: true, force: true });
    },
  };
};

/**
 * Flatten a conversation into a single prompt.
 *
 * Agent CLIs take one prompt, not a message array, so the repair turn — which
 * is genuinely a conversation: bad answer back as assistant, errors back as
 * user — has to be rendered into text. Roles are labelled so the model can
 * still tell its own previous attempt from the correction.
 */
export const renderConversation = (messages: readonly { role: string; content: string }[]): string =>
  messages
    .map((m) => {
      if (m.role === "system") return m.content;
      if (m.role === "assistant") return `<previous_answer>\n${m.content}\n</previous_answer>`;
      return m.content;
    })
    .join("\n\n");
