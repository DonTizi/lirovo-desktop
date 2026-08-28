/**
 * What an update check failure should say to a person.
 *
 * electron-updater reports its failures as whatever the transport handed it,
 * which for the commonest case is four kilobytes of GitHub's HTML headers
 * wrapped around an HTTP status. That is not a message; it is an artefact.
 *
 * The commonest case is also not an error. A copy on the stable channel, in a
 * project whose only release so far is a prerelease, asks GitHub for
 * `/releases/latest`, gets nothing, and falls through to a 406 on the Atom
 * feed. Nothing is wrong: there is simply no stable build yet, and the honest
 * answer says so and names the setting that would find one.
 */

export type UpdateChannel = "latest" | "beta";

/** Is this the "there is no release on this channel" shape, in any of its forms? */
const noReleaseFound = (text: string): boolean =>
  /unable to find latest version/i.test(text) ||
  /no published versions/i.test(text) ||
  /cannot parse releases feed/i.test(text) ||
  /404|406/.test(text);

const offline = (text: string): boolean =>
  /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ENETDOWN|network/i.test(text);

/**
 * One sentence, always. Never a stack, never a header dump.
 *
 * The channel matters to the wording: on stable, "no release yet" has a next
 * step the reader can take, and it is the setting immediately above the button
 * they just pressed.
 */
export const explainUpdateFailure = (raw: unknown, channel: UpdateChannel): string => {
  const text = raw instanceof Error ? `${raw.message}` : String(raw ?? "");

  if (offline(text)) return "no connection — check again when you are online";

  if (noReleaseFound(text)) {
    return channel === "latest"
      ? "no stable release yet. Preview, above, gets prereleases as they are cut"
      : "no build published on this channel yet";
  }

  // Anything unrecognised still gets shortened. A first line is a sentence; a
  // stack trace pasted into a status strip is nothing anyone can act on.
  const first = text.split("\n")[0]?.trim() ?? "";
  if (first === "") return "the check failed";
  return first.length > 120 ? `${first.slice(0, 117)}…` : first;
};
