const { app } = require("electron");
const { rename } = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");

delete process.env.VITE_DEV_SERVER_URL;
const pendingWindow = new Promise((resolve) => app.once("browser-window-created", (_event, window) => resolve(window)));
const wait = async (window, expression) => {
  const deadline = Date.now() + 10_000;
  while (!await window.webContents.executeJavaScript(expression)) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${expression}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};
async function check() {
  await import(pathToFileURL(path.join(__dirname, "../dist-electron/main/index.js")).href);
  const window = await pendingWindow;
  await new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  await wait(window, `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Playback verification')`);
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Playback verification').click()`);
  await wait(window, `document.querySelector('video')?.readyState >= 2`);
  const recording = path.join(process.env.LIROVO_DATA_DIR, "runs/run_abc/normalized/video.mp4");
  await rename(recording, recording + ".held");
  await window.webContents.executeJavaScript(`{ const video=document.querySelector('video');video.src+='?missing';video.load(); }`);
  await wait(window, `document.querySelector('video')?.error !== null && Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry recording')`);
  const retry = `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Retry recording').click()`;
  // A persistent failure remains visible and retryable, never a false success.
  await window.webContents.executeJavaScript(retry);
  await wait(window, `document.querySelector('video')?.currentSrc.includes('playbackAttempt=1') && document.querySelector('video')?.error !== null && Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry recording')`);
  await rename(recording + ".held", recording);
  await window.webContents.executeJavaScript(retry);
  await wait(window, `document.querySelector('video')?.readyState >= 2 && !Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry recording')`);
  await window.webContents.executeJavaScript(`document.querySelector('video').play()`, true);
  await wait(window, `document.querySelector('video').currentTime > 0.5 && document.querySelector('video').getVideoPlaybackQuality().totalVideoFrames > 0`);
  await window.webContents.executeJavaScript(`document.querySelector('video').currentTime=3`);
  await wait(window, `document.querySelector('video').currentTime > 3.3 && Math.abs(document.querySelector('audio').currentTime-document.querySelector('video').currentTime)<0.25`);
  // An interrupted play promise alone must not label a healthy file unplayable.
  await window.webContents.executeJavaScript(`{
    const video=document.querySelector('video'),audio=document.querySelector('audio');
    video.pause();audio.dispatchEvent(new Event('error'));
    video.play=()=>Promise.reject(new DOMException('Interrupted','AbortError'));
    void 0;
  }`);
  await wait(window, `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Audio unavailable · retry')`);
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Audio unavailable · retry').click()`, true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry recording')`), false);
  console.log("PASS native Player: persistent failure, restored recording, decoded frames, seek, audio sync, interrupted-play distinction");
}
check().then(() => app.exit(0)).catch((error) => { console.error(error); app.exit(1); });
