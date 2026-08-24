#!/usr/bin/env node
// A loader, so the compiled TypeScript never has to carry a shebang.
import { main } from "../dist/main.js";
await main(process.argv.slice(2));
