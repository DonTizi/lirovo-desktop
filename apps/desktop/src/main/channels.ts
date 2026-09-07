/**
 * The channel names, and nothing else.
 *
 * Split out of `ipc.ts` because the preload imports them, `ipc.ts` imports zod
 * for its request schemas, and a bundler follows that edge: the preload came
 * out at 122 KB carrying an entire validation library into the one privileged
 * script that sits between a web page and the main process. The schemas belong
 * where they are used — in the main process, which is what validates — and the
 * names belong here, where anything can import them for free.
 */
export const CHANNELS = {
  backupLibrary: "lirovo:backup-library",
  restoreLibrary: "lirovo:restore-library",
  archiveRun: "lirovo:archive-run",
  archivedRuns: "lirovo:archived-runs",
  askKnowledge: "lirovo:ask-knowledge",
  cancelKnowledge: "lirovo:cancel-knowledge",
  exportRun: "lirovo:export-run",
  searchKnowledge: "lirovo:search-knowledge",
  compareKnowledge: "lirovo:compare-knowledge",
  listQueue: "lirovo:list-queue",
  resumeRun: "lirovo:resume-run",
  cancelQueuedRun: "lirovo:cancel-queued-run",
  reviewValue: "lirovo:review-value",
  reviewHistory: "lirovo:review-history",
  doctor: "lirovo:doctor",
  extract: "lirovo:extract",
  cancel: "lirovo:cancel",
  runDetail: "lirovo:run-detail",
  runArtifacts: "lirovo:run-artifacts",
  listRuns: "lirovo:list-runs",
  pickFile: "lirovo:pick-file",
  inspect: "lirovo:inspect",
  listSchemas: "lirovo:list-schemas",
  saveSchema: "lirovo:save-schema",
  schemaRevisions: "lirovo:schema-revisions",
  archiveSchema: "lirovo:archive-schema",
  install: "lirovo:install",
  installProgress: "lirovo:install-progress",
  storage: "lirovo:storage",
  purge: "lirovo:purge",
  reveal: "lirovo:reveal",
  updateState: "lirovo:update-state",
  updateCheck: "lirovo:update-check",
  updateDownload: "lirovo:update-download",
  updateInstall: "lirovo:update-install",
  updateChannel: "lirovo:update-channel",
  updateEvent: "lirovo:update-event",
  busy: "lirovo:busy",
  markOnboarded: "lirovo:mark-onboarded",
  runFix: "lirovo:run-fix",
  setTheme: "lirovo:set-theme",
  preferences: "lirovo:preferences",
  setDefaultBackend: "lirovo:set-default-backend",
  engineEvent: "lirovo:engine-event",
} as const;
