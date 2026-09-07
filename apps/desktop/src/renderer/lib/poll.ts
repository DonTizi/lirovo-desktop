/** Serial polling: a slow read never overlaps the next one; cleanup prevents rescheduling. */
export function pollSerial(
  read: () => Promise<void>,
  delay = 2000,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      await read();
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), delay);
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
