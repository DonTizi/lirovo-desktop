import type { AsrRequest, AsrStrategy, Logger, Transcript } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

/**
 * Try each strategy in order and take the first that succeeds.
 *
 * Ordering is the whole design: free and instant, then local, then paid and
 * remote. A strategy that reports unavailable is skipped silently; one that
 * fails contributes its reason to the final error, because "no ASR strategy
 * succeeded" with no explanation is the least actionable message we could
 * hand a user.
 */
export const createAsrChain = (strategies: readonly AsrStrategy[], logger?: Logger): AsrStrategy => ({
  name: "chain",

  async isAvailable(req: AsrRequest): Promise<boolean> {
    for (const strategy of strategies) {
      if (await strategy.isAvailable(req).catch(() => false)) return true;
    }
    return false;
  },

  async transcribe(req: AsrRequest): Promise<Transcript> {
    const reasons: string[] = [];

    for (const strategy of strategies) {
      const available = await strategy.isAvailable(req).catch(() => false);
      if (!available) {
        reasons.push(`${strategy.name}: unavailable`);
        continue;
      }
      try {
        const transcript = await strategy.transcribe(req);
        logger?.info("transcribed", { engine: transcript.engine, segments: transcript.segments.length });
        return transcript;
      } catch (error) {
        // Cancellation is the user's decision, not a strategy failing: stop
        // rather than moving down the chain and starting new work.
        if (error instanceof LirovoError && error.code === "CANCELLED") throw error;
        const message = error instanceof Error ? error.message : String(error);
        logger?.warn("asr strategy failed", { strategy: strategy.name, message });
        reasons.push(`${strategy.name}: ${message}`);
      }
    }

    throw new LirovoError(
      "TRANSCRIBE_FAILED",
      reasons.length === 0
        ? "no transcription strategy is configured"
        : `no transcription strategy succeeded — ${reasons.join(" | ")}`,
      { stage: "asr" },
    );
  },
});
