#!/usr/bin/env node
/*
 * Validate SKILL.md against the Agent Skills frontmatter requirements used by this
 * repository: name, description length, license, and every linked reference/script.
 * Run: node scripts/validate-skill.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = ['SKILL.md'];
let failed = 0;

function fail(message) {
  failed += 1;
  console.error('FAIL  ' + message);
}
function pass(message) {
  console.log('PASS  ' + message);
}

for (const file of skills) {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) {
    fail(file + ' exists');
    continue;
  }
  const text = readFileSync(full, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    fail(file + ' has YAML frontmatter');
    continue;
  }
  const front = match[1];
  const name = (front.match(/^name:\s*(\S+)/m) || [])[1] || '';
  const description = (front.match(/^description:\s*(.+)$/m) || [])[1] || '';
  const license = (front.match(/^license:\s*(\S+)/m) || [])[1] || '';
  const folder = path.basename(ROOT);

  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length <= 64) pass('name "' + name + '"');
  else fail('name must be lowercase/hyphenated and <=64 chars: "' + name + '"');
  if (description.length >= 40 && description.length <= 1024) pass('description length ' + description.length);
  else fail('description must be 40-1024 chars, got ' + description.length);
  if (license) pass('license "' + license + '"');
  else fail('license missing');
  if (name === 'seo' || folder === name) pass('folder matches skill name');
  else fail('skill folder "' + folder + '" does not match name "' + name + '"');

  const linked = [...text.matchAll(/`((?:references|scripts)\/[^`]+)`/g)].map((m) => m[1]);
  const missing = linked.filter((ref) => !existsSync(path.join(ROOT, ref)));
  if (missing.length) fail('linked files missing: ' + missing.join(', '));
  else pass(linked.length + ' linked references/scripts exist');
}

if (failed) {
  console.error('\nResult: FAIL (' + failed + ')');
  process.exit(1);
}
console.log('\nResult: PASS');
