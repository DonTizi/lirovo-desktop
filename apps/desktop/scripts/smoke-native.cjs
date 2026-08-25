// Proves the native database module loads under ELECTRON's ABI, not Node's.
// Run with the electron binary, never with node — that is the whole point.
const { app } = require("electron");
app.whenReady().then(() => {
  const out = (s) => process.stdout.write(s + "\n");
  out("electron  : " + process.versions.electron);
  out("node      : " + process.versions.node);
  out("modules   : " + process.versions.modules + "  (the ABI a native addon must match)");
  try {
    const Database = require("better-sqlite3");
    const db = new Database(":memory:");
    db.exec("CREATE TABLE t (a INTEGER)");
    db.prepare("INSERT INTO t VALUES (?)").run(42);
    out("sqlite    : ok, read back " + db.prepare("SELECT a FROM t").get().a);
    db.close();
  } catch (e) {
    out("sqlite    : FAILED " + e.message.split("\n")[0]);
  }
  try {
    require("jpeg-js");
    out("jpeg-js   : ok");
  } catch (e) {
    out("jpeg-js   : FAILED " + e.message.split("\n")[0]);
  }
  app.exit(0);
});
