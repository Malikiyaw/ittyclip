import { copyFileSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "..", "node_modules", "@fugood", "node-whisper-wasm");
const dest = join(root, "..", "public", "wasm", "node-whisper-wasm");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const s = join(from, entry);
    const d = join(to, entry);
    if (statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

copyDir(src, dest);
console.log(`[copy-wasm] whisper.cpp WASM assets → public/wasm/node-whisper-wasm/`);
