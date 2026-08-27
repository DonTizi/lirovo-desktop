import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One clock, shared by every view of a run.
 *
 * A transcript, a filmstrip, a graph node and an evidence chip are four
 * projections of the same instant, so they cannot each keep their own position:
 * switching tabs would lose the place, and clicking a timestamp in one would
 * leave the other three describing a different moment.
 *
 * The video element is the clock when there is one. When there is not — a run
 * that failed before normalize — the same store still moves, so a user can
 * still walk the transcript and watch the graph follow.
 */
export interface Lens {
  readonly t: number;
  readonly playing: boolean;
  readonly seek: (t: number) => void;
  readonly attach: (el: HTMLVideoElement | null) => void;
}

export const useLens = (): Lens => {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const frame = useRef<number | null>(null);

  // `timeupdate` fires about four times a second, which is visibly steppy for a
  // playhead. Reading currentTime on every animation frame while playing is
  // both smoother and cheaper than a higher-frequency event would be.
  useEffect(() => {
    if (!playing) return;
    const tick = (): void => {
      const el = video.current;
      if (el !== null) setT(el.currentTime);
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [playing]);

  const attach = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    if (el === null) return;
    const onTime = (): void => setT(el.currentTime);
    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
  }, []);

  const seek = useCallback((to: number) => {
    setT(to);
    const el = video.current;
    if (el === null) return;
    el.currentTime = to;
    // Seeking without playing leaves a still frame and no sound, which reads
    // as the click not having worked.
    void el.play().catch(() => undefined);
  }, []);

  return { t, playing, seek, attach };
};

export const formatTime = (s: number): string => {
  const whole = Math.max(0, Math.floor(s));
  const m = Math.floor(whole / 60);
  return `${m}:${String(whole % 60).padStart(2, "0")}`;
};
