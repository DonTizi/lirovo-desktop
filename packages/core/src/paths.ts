/**
 * Every path the app owns, resolved once and passed down.
 *
 * Nothing derives a path on its own: a stray `homedir()` deep in a stage is how
 * a test starts writing into the real user's library.
 */
export interface LirovoPaths {
  /** Database, config, logs. `~/Library/Application Support/Lirovo` on macOS. */
  readonly data: string;
  /** Per-run working artifacts. Prunable. */
  readonly runs: string;
  /** Downloaded ASR models. Large, checksummed, shared across runs. */
  readonly models: string;
  /** Bundled ffmpeg / yt-dlp / whisper-cli, when the app ships its own. */
  readonly bundledBin: string | null;
  readonly dbFile: string;
}
