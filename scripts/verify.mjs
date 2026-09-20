#!/usr/bin/env node
/**
 * Local / CI verification gate, including dependency and native generation checks.
 * Usage: node scripts/verify.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

function run(label, args) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(npm, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
    shell: isWin,
  });
  if (r.status !== 0) {
    console.error(`FAILED: ${label} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

function assertFile(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`Missing artifact: ${rel}`);
    process.exit(1);
  }
  console.log(`OK ${rel} (${statSync(p).size} bytes)`);
}

function listDir(rel, max = 15) {
  const p = join(root, rel);
  if (!existsSync(p)) return;
  const walk = (dir, prefix = "") => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, relPath);
      else console.log(`  ${rel}/${relPath}`);
    }
  };
  console.log(`\n${rel}/`);
  walk(p);
}

run("doctor", ["run", "doctor"]);
run("audit", ["run", "audit"]);
run("typecheck", ["run", "typecheck"]);
run("test", ["test"]);
run("check:uuid-xcode", ["run", "check:uuid-xcode"]);
run("prebuild:ios:check", ["run", "prebuild:ios:check"]);
run("prebuild:check", ["run", "prebuild:check"]);
run("export:android", ["run", "export:android"]);
run("export:web", ["run", "export:web"]);

console.log("\n=== artifact checks ===");
assertFile("dist-android/metadata.json");
assertFile("dist-web/index.html");
assertFile("dist-web/metadata.json");
listDir("dist-android");
listDir("dist-web");

console.log("\nALL VERIFY GATES PASSED");
