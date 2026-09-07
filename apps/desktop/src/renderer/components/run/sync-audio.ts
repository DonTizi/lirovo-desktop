/** The normalized video is the clock; its separate FLAC follows that clock. */
export function syncAudio(
  video: HTMLVideoElement,
  audio: HTMLAudioElement,
  onError: () => void,
): () => void {
  let alive = true;
  const align = (): void => {
    if (Math.abs(audio.currentTime - video.currentTime) > 0.25)
      audio.currentTime = video.currentTime;
    audio.playbackRate = video.playbackRate;
  };
  const play = (): void => {
    align();
    if (video.paused || video.seeking || video.ended) return;
    void audio.play().catch((error: unknown) => {
      if (
        alive &&
        !video.paused &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        onError();
    });
  };
  const pause = (): void => audio.pause();
  const listeners: [string, () => void][] = [
    ["play", play],
    ["playing", play],
    ["seeked", play],
    ["pause", pause],
    ["ended", pause],
    ["waiting", pause],
    ["seeking", pause],
    ["timeupdate", align],
    ["ratechange", align],
  ];
  for (const [event, handler] of listeners)
    video.addEventListener(event, handler);
  audio.addEventListener("loadedmetadata", play);
  audio.addEventListener("error", onError);
  play();
  return () => {
    alive = false;
    for (const [event, handler] of listeners)
      video.removeEventListener(event, handler);
    audio.removeEventListener("loadedmetadata", play);
    audio.removeEventListener("error", onError);
    audio.pause();
  };
}
