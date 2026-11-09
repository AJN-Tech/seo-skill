#!/usr/bin/env node
/*
 * seo-skill CLI — install the `seo` Agent Skill for AI harnesses, or run the
 * bundled auditor. Node 18+, no dependencies.
 *
 * npx -y github:AJN-Tech/seo-skill
 * npx -y github:AJN-Tech/seo-skill check
 * npx -y github:AJN-Tech/seo-skill audit https://example.com --json
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version || '0.0.0';
const SKILL_NAME = 'seo';
const SKILL_FILES = ['SKILL.md', 'README.md', 'LICENSE'];
const SKILL_DIRS = ['references', 'scripts', 'docs'];
const HARNESSES = ['agents', 'claude', 'codex', 'opencode', 'dsh', 'cursor', 'gemini'];
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'seo-audit.mjs');

const help = `seo-skill ${VERSION} — install the portable SEO Agent Skill for AI harnesses

Usage:
  npx -y github:AJN-Tech/seo-skill [install] [options]
  npx -y github:AJN-Tech/seo-skill check [options]
  npx -y github:AJN-Tech/seo-skill uninstall [options]
  npx -y github:AJN-Tech/seo-skill audit <url|dir> [audit options]

Default install targets:
  ~/.agents/skills/seo     Codex, OpenCode, DeepSeek Harness, Cursor, Gemini CLI
  ~/.claude/skills/seo     Claude Code (installed when detected, or with --all)

Install options:
  --all                    Universal target + Claude Code
  --harness NAME           agents|claude|codex|opencode|dsh|cursor|gemini (repeatable)
  --native                 Use opencode/dsh/cursor/gemini private directories
  --project DIR            Install into DIR/.agents/skills/seo + DIR/.claude/skills/seo
  --agents-md [DIR]        Append a pointer block to DIR/AGENTS.md (default: cwd)
  --link                   Symlink the package directory instead of copying
  --force                  Replace an existing install
  --dry-run                Print actions without writing
  --check                  Verify the selected install(s)
  --uninstall              Remove the selected install(s)

Audit:
  npx -y github:AJN-Tech/seo-skill audit https://example.com
  npx -y github:AJN-Tech/seo-skill audit ./dist --base https://example.com --json
  (all options are forwarded to scripts/seo-audit.mjs; see --audit-help)

Other:
  --version, -v            Print the version
  --help, -h               This help

After publishing to npm the same commands work as: npx -y seo-skill ...
`;

function fail(message) {
  process.stderr.write('error: ' + message + '\n');
  process.exit(2);
}

function log(message) {
  process.stdout.write(message + '\n');
}

function commandExists(name) {
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  const directories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return directories.some((directory) =>
    extensions.some((extension) => existsSync(path.join(directory, name + extension)))
  );
}

function resolveHome() {
  return process.env.SEO_SKILL_HOME || os.homedir();
}

function assertSkillTarget(target) {
  if (!/(?:^|[\\/])skills[\\/]seo$/.test(target)) {
    fail('refusing unsafe target path: ' + target);
  }
}

function copySkill(target) {
  mkdirSync(target, { recursive: true });
  SKILL_FILES.forEach((file) => {
    const source = path.join(ROOT, file);
    if (existsSync(source)) copyFileSync(source, path.join(target, file));
  });
  SKILL_DIRS.forEach((directory) => {
    const source = path.join(ROOT, directory);
    if (existsSync(source)) cpSync(source, path.join(target, directory), { recursive: true });
  });
}

function installTarget(target, options) {
  assertSkillTarget(target);
  if (existsSync(target)) {
    if (options.dryRun) {
      log('exists -> ' + target + (options.force ? ' (would replace)' : ' (pass --force to replace)'));
      return;
    }
    if (!options.force) fail('already exists: ' + target + ' (use --force or --uninstall)');
    rmSync(target, { recursive: true, force: true });
  }
  if (options.dryRun) {
    log('would install -> ' + target);
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  if (options.link) {
    symlinkSync(ROOT, target, process.platform === 'win32' ? 'junction' : 'dir');
  } else {
    copySkill(target);
  }
  log('installed -> ' + target);
}

function checkTarget(target) {
  assertSkillTarget(target);
  const skillFile = path.join(target, 'SKILL.md');
  if (!existsSync(skillFile)) {
    log('MISSING -> ' + target);
    return false;
  }
  const text = readFileSync(skillFile, 'utf8');
  if (!/^name:\s*seo$/m.test(text)) {
    log('INVALID -> ' + target + ' (SKILL.md name is not seo)');
    return false;
  }
  log('ok      -> ' + target);
  return true;
}

function uninstallTarget(target, options) {
  assertSkillTarget(target);
  if (!existsSync(target)) {
    log('not installed -> ' + target);
    return;
  }
  if (options.dryRun) {
    log('would remove -> ' + target);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  log('removed -> ' + target);
}

function parseOptions(args) {
  const options = {
    all: false,
    harnesses: [],
    native: false,
    project: null,
    agentsMd: null,
    link: false,
    force: false,
    dryRun: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--all':
        options.all = true;
        break;
      case '--harness': {
        const value = args[++index];
        if (!value) fail('--harness needs a value');
        options.harnesses.push(value.toLowerCase());
        break;
      }
      case '--native':
        options.native = true;
        break;
      case '--project': {
        const value = args[++index];
        if (!value) fail('--project needs a directory');
        options.project = path.resolve(value);
        break;
      }
      case '--agents-md': {
        const next = args[index + 1];
        if (next && !next.startsWith('-')) {
          options.agentsMd = path.resolve(args[++index]);
        } else {
          options.agentsMd = process.cwd();
        }
        break;
      }
      case '--link':
        options.link = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        fail('unknown option: ' + arg + ' (see --help)');
    }
  }
  return options;
}

function targetsFor(options, mode) {
  const home = resolveHome();
  const targets = [];
  const add = (target) => {
    if (!targets.includes(target)) targets.push(target);
  };
  const agents = path.join(home, '.agents', 'skills', SKILL_NAME);
  const claude = path.join(home, '.claude', 'skills', SKILL_NAME);

  if (options.project) {
    add(path.join(options.project, '.agents', 'skills', SKILL_NAME));
    add(path.join(options.project, '.claude', 'skills', SKILL_NAME));
    return targets;
  }

  const claudeDetected = existsSync(path.join(home, '.claude')) || commandExists('claude');

  if (options.all) {
    add(agents);
    add(claude);
    return targets;
  }

  if (options.harnesses.length) {
    options.harnesses.forEach((harness) => {
      switch (harness) {
        case 'agents':
        case 'codex':
          add(agents);
          break;
        case 'claude':
          add(claude);
          break;
        case 'opencode':
          add(
            options.native
              ? path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode', 'skills', SKILL_NAME)
              : agents
          );
          break;
        case 'dsh':
          add(
            options.native
              ? path.join(process.env.DSH_HOME || path.join(home, '.dsh'), 'skills', SKILL_NAME)
              : agents
          );
          break;
        case 'cursor':
          add(options.native ? path.join(home, '.cursor', 'skills', SKILL_NAME) : agents);
          break;
        case 'gemini':
          add(options.native ? path.join(home, '.gemini', 'skills', SKILL_NAME) : agents);
          break;
        default:
          fail('unknown harness: ' + harness + ' (' + HARNESSES.join('|') + ')');
      }
    });
    return targets;
  }

  if (mode === 'check' || mode === 'uninstall') {
    add(agents);
    add(claude);
    return targets;
  }

  add(agents);
  if (claudeDetected) add(claude);
  return targets;
}

function addAgentsPointer(directory, options) {
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'AGENTS.md');
  const marker = '<!-- seo-skill:start';
  if (existsSync(file) && readFileSync(file, 'utf8').includes(marker)) {
    log('AGENTS.md pointer already present -> ' + file);
    return;
  }
  if (options.dryRun) {
    log('would add SEO pointer -> ' + file);
    return;
  }
  const block = [
    '',
    '<!-- seo-skill:start (AJN-Tech/seo-skill) -->',
    '## SEO work',
    '',
    'When a task involves SEO, read the `seo` skill first: `' + path.join(resolveHome(), '.agents', 'skills', SKILL_NAME, 'SKILL.md') + '`.',
    'It contains the audit workflow, references and a read-only auditor (`scripts/seo-audit.mjs`).',
    'Do not invent SEO data; run the checks or state what could not be verified.',
    '<!-- seo-skill:end -->',
    ''
  ].join('\n');
  appendFileSync(file, block, 'utf8');
  log('added SEO pointer -> ' + file);
}

function printVerify() {
  log('');
  log('Verify in your harness (restart if the skill list was already loaded):');
  log('  Claude Code       /seo');
  log('  Codex             /skills  or  $seo');
  log('  OpenCode          ask for an SEO audit (skill tool)');
  log('  DeepSeek Harness  new session; the skill list should include "seo"');
  log('  Cursor            /seo  or  @seo');
  log('  Gemini CLI        /skills list');
}

function runInstall(args) {
  const options = parseOptions(args);
  const selector = options.all || options.harnesses.length > 0 || options.project;
  // --agents-md can be used on its own; only install default targets when no
  // other selector was given and no pointer-only request was made.
  const targets = selector || !options.agentsMd ? targetsFor(options, 'install') : [];
  if (!targets.length && !options.agentsMd) {
    fail('nothing to install; pass --all, --harness NAME or --project DIR');
  }
  targets.forEach((target) => installTarget(target, options));
  if (options.agentsMd) addAgentsPointer(options.agentsMd, options);
  if (!options.dryRun && targets.length) printVerify();
}

function runCheck(args) {
  const options = parseOptions(args);
  const targets = targetsFor(options, 'check');
  const ok = targets.every((target) => checkTarget(target));
  process.exit(ok ? 0 : 1);
}

function runUninstall(args) {
  const options = parseOptions(args);
  const targets = targetsFor(options, 'uninstall');
  targets.forEach((target) => uninstallTarget(target, options));
}

function runAudit(args) {
  if (args.includes('--audit-help')) {
    const result = spawnSync(process.execPath, [AUDIT_SCRIPT, '--help'], { stdio: 'inherit' });
    process.exit(result.status || 0);
  }
  if (!args.length) {
    process.stderr.write('audit needs a URL or directory; try --help\n');
    process.exit(2);
  }
  const result = spawnSync(process.execPath, [AUDIT_SCRIPT, 'audit', ...args], { stdio: 'inherit' });
  process.exit(result.status === null ? 2 : result.status);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--version') || argv.includes('-v')) {
    log(VERSION);
    return;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(help);
    return;
  }
  const command = argv[0] && ['install', 'check', 'uninstall', 'audit'].includes(argv[0]) ? argv.shift() : 'install';
  switch (command) {
    case 'install':
      runInstall(argv);
      break;
    case 'check':
      runCheck(argv);
      break;
    case 'uninstall':
      runUninstall(argv);
      break;
    case 'audit':
      runAudit(argv);
      break;
    default:
      fail('unknown command: ' + command);
  }
}

main();
