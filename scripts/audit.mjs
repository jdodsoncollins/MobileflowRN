#!/usr/bin/env node
/**
 * npm audit --audit-level=low, minus Expo SDK / Metro advisories that
 * have no patched release until an SDK bump.
 */
import { spawnSync } from 'node:child_process';

const ALLOW = new Set([
  'GHSA-w3rx-r6r6-pgpr',
  'GHSA-5p2g-fcmc-qvqq',
  // brace-expansion 1.x is what Metro/minimatch use; forcing 2.x/5.x
  // breaks EAS fingerprint (`expand is not a function`).
  'GHSA-mh99-v99m-4gvg',
  'GHSA-rgw5-rvv9-x895',
  // vitest 3.2.x (Takt stack) is unmaintained for this mocker advisory;
  // patched in 4.1.11. We do not run Vitest browser/mocker redirect.
  'GHSA-82fw-gwwq-j7x9',
]);

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
const raw = result.stdout || '';
const start = raw.indexOf('{');
if (start < 0) {
  console.error(result.stderr || 'npm audit produced no JSON');
  process.exit(1);
}

const report = JSON.parse(raw.slice(start));
const unexpected = [];
for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const item of vuln.via ?? []) {
    if (typeof item !== 'object' || !item.url) continue;
    const id = String(item.url).split('/').pop();
    if (ALLOW.has(id)) continue;
    unexpected.push({
      name,
      id,
      severity: item.severity,
      title: item.title,
    });
  }
}

if (unexpected.length) {
  console.error('Unexpected npm advisories:');
  for (const row of unexpected) {
    console.error(`  ${row.severity} ${row.name} ${row.id} ${row.title}`);
  }
  process.exit(1);
}

console.log(
  'audit: no unexpected advisories (Expo Metro image-size and brace-expansion are allowlisted).',
);
