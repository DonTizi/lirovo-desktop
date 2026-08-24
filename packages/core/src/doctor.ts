import type { AsrStrategy, InferenceBackend } from "@lirovo/contracts";
import type { BinaryStatus, DependencySpec } from "./dependencies.js";
import type { LirovoPaths } from "./paths.js";

export interface BackendStatus {
  readonly id: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly reason: string | null;
  readonly nativeJsonSchema: boolean;
  readonly images: boolean;
  readonly spawnsProcessPerCall: boolean;
}

export interface DoctorReport {
  readonly paths: LirovoPaths;
  readonly dependencies: readonly BinaryStatus[];
  readonly backends: readonly BackendStatus[];
  readonly asrStrategies: readonly string[];
  /** Blocking problems. Empty means the pipeline can run. */
  readonly problems: readonly string[];
  /** Non-blocking, but the user is losing something. */
  readonly warnings: readonly string[];
  readonly ok: boolean;
}

export interface DoctorDeps {
  readonly paths: LirovoPaths;
  readonly dependencies: readonly DependencySpec[];
  readonly probeBinary: (spec: DependencySpec) => Promise<BinaryStatus>;
  readonly backends: readonly InferenceBackend[];
  readonly asrStrategies: readonly AsrStrategy[];
}

const describeBackend = async (backend: InferenceBackend): Promise<BackendStatus> => {
  const probe = await backend.detect().catch((e: unknown) => ({
    available: false,
    version: null,
    reason: e instanceof Error ? e.message : String(e),
  }));
  return {
    id: backend.id,
    available: probe.available,
    version: probe.version,
    reason: "reason" in probe ? (probe.reason ?? null) : null,
    nativeJsonSchema: backend.capabilities.nativeJsonSchema,
    images: backend.capabilities.images,
    spawnsProcessPerCall: backend.capabilities.spawnsProcessPerCall,
  };
};

/**
 * The pre-flight check. Pure orchestration over injected probes so the whole
 * report is reproducible in a test with no binaries and no network.
 */
export const runDoctor = async (deps: DoctorDeps): Promise<DoctorReport> => {
  const dependencies = await Promise.all(deps.dependencies.map((spec) => deps.probeBinary(spec)));
  const backends = await Promise.all(deps.backends.map(describeBackend));

  const problems: string[] = [];
  const warnings: string[] = [];

  for (const dep of dependencies) {
    if (dep.found) continue;
    const line = `${dep.id} not found — needed to ${dep.why}`;
    if (dep.required) problems.push(line);
    else warnings.push(line);
  }

  const usable = backends.filter((b) => b.available);
  if (usable.length === 0) {
    problems.push(
      "no inference backend available — start a local OpenAI-compatible server, set an API key, or install a supported agent CLI",
    );
  }

  // A backend that spawns a process per call is fine for the two text calls and
  // ruinous for the dozens of vision calls, so it can never be the only option
  // for images. Saying so here beats discovering it 68 spawns into a run.
  const imageCapable = usable.filter((b) => b.images && !b.spawnsProcessPerCall);
  if (usable.length > 0 && imageCapable.length === 0) {
    warnings.push(
      "no backend can analyse frames — extraction will run audio-only (visual evidence disabled)",
    );
  }

  if (deps.asrStrategies.length === 0) {
    problems.push("no transcription strategy available");
  }

  return {
    paths: deps.paths,
    dependencies,
    backends,
    asrStrategies: deps.asrStrategies.map((s) => s.name),
    problems,
    warnings,
    ok: problems.length === 0,
  };
};
