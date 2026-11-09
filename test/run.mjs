#!/usr/bin/env node
/*
 * Test runner for the seo-audit script. No dependencies.
 * Run: node test/run.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const AUDIT = path.join(ROOT, 'scripts', 'seo-audit.mjs');
const GOOD = path.join(ROOT, 'test', 'fixtures', 'good');
const BROKEN = path.join(ROOT, 'test', 'fixtures', 'broken');
const BASE = 'https://good.example/';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name + (detail ? '  (' + detail + ')' : ''));
  } else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? '\n          ' + detail : ''));
  }
}

function run(args) {
  const result = spawnSync(process.execPath, [AUDIT, ...args], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return result;
}

function runJson(args) {
  const result = run([...args, '--json']);
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch (error) {
    /* handled by caller */
  }
  return { result, json };
}

function codes(json) {
  return new Set((json.findings || []).map((finding) => finding.code));
}

console.log('seo-audit test suite');

// --- good fixture ---------------------------------------------------------
const good = runJson(['audit', GOOD, '--base', BASE]);
check('good fixture: audit exits 0', good.result.status === 0, 'status ' + good.result.status);
check('good fixture: JSON parses', Boolean(good.json), good.result.stderr.slice(0, 300));
if (good.json) {
  check('good fixture: pages discovered', good.json.summary.pages >= 3, good.json.summary.pages + ' pages');
  check('good fixture: no critical findings', good.json.summary.findings.critical === 0,
    JSON.stringify(good.json.findings.filter((finding) => finding.severity === 'critical')));
  check('good fixture: no high findings', good.json.summary.findings.high === 0,
    JSON.stringify(good.json.findings.filter((finding) => finding.severity === 'high')));
  check('good fixture: robots.txt valid', good.json.crawlFiles.robots.state === 'ok', good.json.crawlFiles.robots.state);
  check('good fixture: sitemap valid', good.json.crawlFiles.sitemap.state === 'ok', good.json.crawlFiles.sitemap.state);
  check('good fixture: llms.txt valid', good.json.crawlFiles.llms.state === 'ok', good.json.crawlFiles.llms.state);
  check('good fixture: no broken internal links', !codes(good.json).has('internal-link-broken'));
  check('good fixture: hreflang reciprocal', !codes(good.json).has('hreflang-not-reciprocal'));
}

const goodGate = run(['audit', GOOD, '--base', BASE, '--fail-on', 'high', '--json']);
check('good fixture passes --fail-on high', goodGate.status === 0, 'status ' + goodGate.status);

// --- broken fixture -------------------------------------------------------
const broken = runJson(['audit', BROKEN, '--base', 'https://broken.example/']);
check('broken fixture: audit exits 0 (findings, not errors)', broken.result.status === 0, 'status ' + broken.result.status);
check('broken fixture: JSON parses', Boolean(broken.json), broken.result.stderr.slice(0, 300));
if (broken.json) {
  const found = codes(broken.json);
  const expected = [
    'title-missing',
    'title-duplicate',
    'description-missing',
    'lang-missing',
    'canonical-missing',
    'h1-multiple',
    'image-alt-missing',
    'structured-data-invalid-json',
    'render-blocking-css',
    'render-blocking-js',
    'viewport-missing',
    'open-graph-incomplete',
    'robots-missing',
    'sitemap-missing',
    'internal-link-broken',
    'hreflang-missing-x-default',
    'hreflang-not-reciprocal',
    'content-near-duplicate'
  ];
  expected.forEach((code) => {
    check('broken fixture: detects ' + code, found.has(code));
  });
  check('broken fixture: has high findings', broken.json.summary.findings.high > 0,
    JSON.stringify(broken.json.summary.findings));
  check('broken fixture: near-duplicate pair reported', broken.json.nearDuplicates.length > 0,
    JSON.stringify(broken.json.nearDuplicates));
}

const brokenGate = run(['audit', BROKEN, '--base', 'https://broken.example/', '--fail-on', 'high', '--json']);
check('broken fixture fails --fail-on high', brokenGate.status === 1, 'status ' + brokenGate.status);

// --- crawl-files command --------------------------------------------------
const crawl = runJson(['crawl-files', GOOD, '--base', BASE]);
check('crawl-files: exits 0', crawl.result.status === 0, 'status ' + crawl.result.status);
if (crawl.json) {
  check('crawl-files: robots ok', crawl.json.crawlFiles.robots.state === 'ok', crawl.json.crawlFiles.robots.state);
  check('crawl-files: sitemap ok', crawl.json.crawlFiles.sitemap.state === 'ok', crawl.json.crawlFiles.sitemap.state);
  check('crawl-files: sitemap has URLs', crawl.json.crawlFiles.sitemap.urls >= 3, String(crawl.json.crawlFiles.sitemap.urls));
}

// --- out file + error handling -------------------------------------------
const dir = mkdtempSync(path.join(tmpdir(), 'seo-audit-'));
const outFile = path.join(dir, 'report.json');
const outRun = run(['audit', GOOD, '--base', BASE, '--json', '--out', outFile]);
check('--out writes a report', outRun.status === 0 && existsSync(outFile));
if (existsSync(outFile)) {
  const written = JSON.parse(readFileSync(outFile, 'utf8'));
  check('--out report is valid JSON', Array.isArray(written.findings));
}
const missing = run(['audit', path.join(ROOT, 'nope'), '--json']);
check('missing target exits 2', missing.status === 2, 'status ' + missing.status);

// --- npx-compatible CLI ---------------------------------------------------
const BIN = path.join(ROOT, 'bin', 'seo-skill.mjs');
const cliHome = mkdtempSync(path.join(tmpdir(), 'seo-cli-home-'));
const cliProject = mkdtempSync(path.join(tmpdir(), 'seo-cli-project-'));
const cliEnv = { ...process.env, SEO_SKILL_HOME: cliHome };
function runCli(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: cliEnv
  });
}
const version = runCli(['--version']);
check('CLI: --version exits 0', version.status === 0 && /^\d+\.\d+\.\d+/.test(version.stdout.trim()),
  version.stdout.trim());
const cliInstall = runCli(['install', '--all']);
check(
  'CLI: install --all writes both targets',
  cliInstall.status === 0 &&
    existsSync(path.join(cliHome, '.agents', 'skills', 'seo', 'SKILL.md')) &&
    existsSync(path.join(cliHome, '.claude', 'skills', 'seo', 'SKILL.md')),
  cliInstall.stderr.slice(0, 200)
);
const cliCheck = runCli(['check', '--all']);
check('CLI: check --all passes', cliCheck.status === 0, cliCheck.stdout.trim().slice(0, 200));
const cliProjectRun = runCli(['install', '--project', cliProject]);
check(
  'CLI: --project installs both project targets',
  cliProjectRun.status === 0 &&
    existsSync(path.join(cliProject, '.agents', 'skills', 'seo', 'SKILL.md')) &&
    existsSync(path.join(cliProject, '.claude', 'skills', 'seo', 'SKILL.md')),
  cliProjectRun.stderr.slice(0, 200)
);
const pointerDir = mkdtempSync(path.join(tmpdir(), 'seo-cli-agents-'));
const pointerRun = runCli(['install', '--agents-md', pointerDir]);
check(
  'CLI: standalone --agents-md writes the pointer',
  pointerRun.status === 0 && existsSync(path.join(pointerDir, 'AGENTS.md')) &&
    readFileSync(path.join(pointerDir, 'AGENTS.md'), 'utf8').includes('seo-skill:start'),
  pointerRun.stderr.slice(0, 200)
);
const cliAudit = runCli(['audit', GOOD, '--base', BASE, '--json']);
let cliAuditJson = null;
try {
  cliAuditJson = JSON.parse(cliAudit.stdout);
} catch (error) {
  /* handled by the check */
}
check(
  'CLI: audit delegates to the auditor',
  cliAudit.status === 0 && cliAuditJson && cliAuditJson.summary.pages >= 3,
  cliAudit.stderr.slice(0, 200)
);
const cliUninstall = runCli(['uninstall', '--all']);
check(
  'CLI: uninstall --all removes both targets',
  cliUninstall.status === 0 &&
    !existsSync(path.join(cliHome, '.agents', 'skills', 'seo')) &&
    !existsSync(path.join(cliHome, '.claude', 'skills', 'seo'))
);

// --- summary --------------------------------------------------------------
console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) {
  console.log('Result: FAIL');
  process.exit(1);
}
console.log('Result: PASS');
