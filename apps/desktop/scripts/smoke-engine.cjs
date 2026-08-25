// Drives the real engine process the way the main process does: fork it, ask
// for a doctor report, print what comes back. Proves the utilityProcess, the
// message protocol and node:sqlite all work under Electron — headlessly.
const path = require("node:path");
const { app, utilityProcess } = require("electron");

app.whenReady().then(() => {
  const out = (s) => process.stdout.write(s + "\n");
  const child = utilityProcess.fork(path.join(__dirname, "..", "dist-electron", "main", "engine-host.js"), [], {
    stdio: "inherit",
  });

  const timer = setTimeout(() => {
    out("TIMEOUT: the engine never answered");
    app.exit(1);
  }, 30000);

  child.on("message", (msg) => {
    if (msg.kind !== "result") return;
    clearTimeout(timer);
    const r = msg.value;
    out("engine answered.");
    out("  db path   : " + r.paths.dbFile);
    out("  ready     : " + r.ok);
    out("  deps      : " + r.dependencies.map((d) => d.id + (d.found ? "=ok" : "=MISSING")).join(" "));
    out("  backends  : " + r.backends.map((b) => b.id + (b.available ? "=ok" : "=no")).join(" "));
    out("  asr       : " + r.asr.map((a) => a.name + (a.forFile || a.forUrl ? "=ok" : "=no")).join(" "));
    child.kill();
    app.exit(0);
  });

  child.postMessage({ id: "smoke-1", type: "doctor" });
});
