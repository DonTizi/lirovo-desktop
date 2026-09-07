import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotionPreference(notify: () => void): () => void {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const readMotionPreference = () => window.matchMedia(motionQuery).matches;
const serverMotionPreference = () => true;

/** Observe preference changes while this desktop view stays mounted. */
export function useGraphReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotionPreference,
    readMotionPreference,
    serverMotionPreference,
  );
}

/** No frame loop while paused, offscreen, in a background tab or under inspection. */
export function useGraphMotion(
  element: RefObject<SVGSVGElement>,
  enabled: boolean,
  identity: unknown,
): number {
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef(0);
  useEffect(() => {
    clock.current = 0;
    setElapsed(0);
  }, [identity]);
  useEffect(() => {
    const target = element.current;
    if (!enabled || !target) return;
    let frame = 0;
    let previous = 0;
    let published = 0;
    let visible = true;
    const tick = (now: number) => {
      if (previous) clock.current += Math.min(now - previous, 50);
      previous = now;
      if (now - published >= 32) {
        setElapsed(clock.current);
        published = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      update();
    });
    observer.observe(target);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [element, enabled, identity]);
  return elapsed;
}
