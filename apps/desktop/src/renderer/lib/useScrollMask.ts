import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * A fade on whichever edge actually has more content.
 *
 * Applied permanently on both ends it implies there is something above and
 * below even when the list is three rows long, which teaches people to scroll
 * at nothing. Applied dynamically it is the only honest signal that content
 * continues past the edge.
 */
export const useScrollMask = (
  ref: RefObject<HTMLElement>,
  deps: readonly unknown[],
): { maskImage: string | undefined; onScroll: () => void } => {
  const [up, setUp] = useState(false);
  const [down, setDown] = useState(false);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el === null) return;
    setUp(el.scrollTop > 1);
    setDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, [ref]);

  useEffect(() => {
    onScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScroll, ...deps]);

  const maskImage =
    up && down
      ? "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)"
      : up
        ? "linear-gradient(to bottom, transparent 0, black 20px, black 100%)"
        : down
          ? "linear-gradient(to bottom, black 0, black calc(100% - 20px), transparent 100%)"
          : undefined;

  return { maskImage, onScroll };
};
