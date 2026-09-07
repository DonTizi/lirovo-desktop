import { describe, expect, it, vi } from "vitest";
import { syncAudio } from "./sync-audio";

class Media extends EventTarget {
  currentTime = 0;
  playbackRate = 1;
  paused = true;
  seeking = false;
  ended = false;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  fire(event: string): void {
    this.dispatchEvent(new Event(event));
  }
}
const linked = () => {
  const video = new Media();
  const audio = new Media();
  const onError = vi.fn();
  const stop = syncAudio(
    video as unknown as HTMLVideoElement,
    audio as unknown as HTMLAudioElement,
    onError,
  );
  return { video, audio, onError, stop };
};

describe("normalized audio follows video", () => {
  it("plays, pauses while buffering, seeks backwards, and detaches", () => {
    const { video, audio, stop } = linked();
    video.currentTime = 625.2;
    video.paused = false;
    video.fire("playing");
    expect(audio.currentTime).toBe(625.2);
    expect(audio.paused).toBe(false);
    video.fire("waiting");
    expect(audio.paused).toBe(true);
    video.currentTime = 62.8;
    video.fire("seeked");
    expect(audio.currentTime).toBe(62.8);
    expect(audio.paused).toBe(false);
    video.paused = true;
    video.fire("pause");
    expect(audio.paused).toBe(true);
    stop();
    video.paused = false;
    video.fire("playing");
    expect(audio.paused).toBe(true);
  });
  it("corrects drift and rate without restarting paused playback", () => {
    const { video, audio, stop } = linked();
    video.currentTime = 10;
    video.playbackRate = 1.5;
    video.fire("timeupdate");
    expect(audio.currentTime).toBe(10);
    expect(audio.playbackRate).toBe(1.5);
    expect(audio.paused).toBe(true);
    stop();
  });
  it("reports a rejected play but ignores an expected interruption", async () => {
    const { video, audio, onError, stop } = linked();
    audio.play.mockRejectedValueOnce(
      new DOMException("blocked", "NotAllowedError"),
    );
    video.paused = false;
    video.fire("playing");
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    audio.play.mockRejectedValueOnce(
      new DOMException("interrupted", "AbortError"),
    );
    video.fire("playing");
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    stop();
  });
});
