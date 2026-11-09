#!/usr/bin/env node
/*
 * seo-audit.mjs — dependency-free SEO auditor for live sites and static builds.
 *
 * Part of https://github.com/AJN-Tech/seo-skill (MIT). Read-only: it fetches public
 * pages (one at a time, bounded) or reads local files, then reports evidence-backed
 * findings with a severity, owner and validation hint.
 *
 * Usage:
 *   node seo-audit.mjs audit <url|dir> [options]
 *   node seo-audit.mjs page <url|dir/page.html> [options]
 *   node seo-audit.mjs crawl-files <url|dir> [options]
 *
 * Options:
 *   --json                 Print JSON instead of Markdown.
 *   --out <file>           Also write the rendered report to <file>.
 *   --base <url>           Base URL for a local build directory (needed for URL checks).
 *   --max-pages <n>        Maximum pages to audit (default 40).
 *   --timeout <ms>         Per-request timeout (default 15000).
 *   --user-agent <ua>      Crawler user agent.
 *   --fail-on <severity>   Exit 1 if a finding at/above this severity exists.
 *   --quiet                Only print the report, no progress lines.
 *   --help                 Show this help.
 *
 * Exit codes: 0 audit completed (unless --fail-on triggers), 1 failure threshold hit,
 * 2 invalid usage or target.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const DEFAULT_UA =
  'ajax-seo-audit/1.0 (AJN-Tech seo-skill; read-only; https://github.com/AJN-Tech/seo-skill)';

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

class Audit {
  constructor(options) {
    this.options = options;
    this.findings = [];
    this.seen = new Set();
    this.pages = [];
    this.notes = [];
    this.crawlFiles = { robots: null, sitemap: null, llms: null };
    this.duplicatePairs = [];
    this.startedAt = new Date().toISOString();
  }

  add(finding) {
    const key = [finding.code, finding.page || '', finding.evidence || ''].join('|');
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.findings.push({
      severity: 'medium',
      area: 'general',
      owner: 'code',
      page: '',
      evidence: '',
      fix: '',
      validation: '',
      ...finding
    });
    this.findings.sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    );
  }

  note(message) {
    this.notes.push(message);
  }

  summary() {
    const bySeverity = {};
    const byArea = {};
    SEVERITIES.forEach((severity) => {
      bySeverity[severity] = 0;
    });
    this.findings.forEach((finding) => {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
      byArea[finding.area] = (byArea[finding.area] || 0) + 1;
    });
    return {
      pages: this.pages.length,
      findings: bySeverity,
      byArea,
      crawlFiles: {
        robots: this.crawlFiles.robots ? this.crawlFiles.robots.state : 'not checked',
        sitemap: this.crawlFiles.sitemap ? this.crawlFiles.sitemap.state : 'not checked',
        llms: this.crawlFiles.llms ? this.crawlFiles.llms.state : 'not checked'
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchResource(url, options, redirects = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': options.userAgent,
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'accept-encoding': 'br, gzip'
      }
    });
    const contentType = response.headers.get('content-type') || '';
    const headers = Object.fromEntries(response.headers.entries());
    let body = '';
    if (
      /text\/html|application\/xhtml|text\/plain|application\/xml|text\/xml|application\/json/.test(
        contentType
      )
    ) {
      body = await response.text();
    } else {
      body = '';
    }
    return {
      url,
      finalUrl: response.url,
      status: response.status,
      headers,
      contentType,
      html: body,
      redirects
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      status: 0,
      headers: {},
      contentType: '',
      html: '',
      error: error && error.message ? error.message : String(error)
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTML helpers (regex/token based; no DOM dependency)
// ---------------------------------------------------------------------------

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"'
};

function decodeEntities(value) {
  return String(value)
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const code =
          entity[1].toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      const decoded = ENTITIES[entity.toLowerCase()];
      return decoded === undefined ? match : decoded;
    });
}

function stripHtml(html) {
  return decodeEntities(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|template|noscript|svg|iframe|object)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function visibleText(html) {
  const main = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const article = String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const source = main ? main[1] : article ? article[1] : html;
  return stripHtml(source);
}

function words(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

// Scan tags while respecting quoted attribute values (so `>` inside an attribute
// does not end the tag early).
function parseTags(html) {
  const tags = [];
  const source = String(html);
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf('<', index);
    if (start === -1) break;
    const next = source[start + 1];
    if (!next || next === '!' || next === '?' || next === '/') {
      index = start + 1;
      continue;
    }
    let quote = '';
    let cursor = start + 1;
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
      cursor += 1;
    }
    if (cursor >= source.length) break;
    const raw = source.slice(start, cursor + 1);
    const nameMatch = raw.match(/^<([a-zA-Z][\w:-]*)/);
    if (!nameMatch) {
      index = cursor + 1;
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    const attrsRaw = raw.slice(nameMatch[0].length, -1);
    tags.push({ name, raw, attrsRaw, start });
    index = cursor + 1;
  }
  return tags;
}

function attr(tag, name) {
  const pattern = new RegExp(
    '(?:^|\\s)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))',
    'i'
  );
  const raw = tag.raw !== undefined ? tag.raw : String(tag);
  const match = raw.match(pattern);
  if (!match) {
    // Support boolean attributes (defer, async, crossorigin, ...).
    const bare = new RegExp(
      '(?:^|\\s)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|/|>)',
      'i'
    );
    return bare.test(raw) ? '' : null;
  }
  return decodeEntities(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]);
}

function rel(tag) {
  const value = attr(tag, 'rel');
  return value ? value.toLowerCase().split(/\s+/).filter(Boolean) : [];
}

function findTags(tags, name) {
  return tags.filter((tag) => tag.name === name);
}

function findTagsByRel(tags, name, relValue) {
  return tags.filter((tag) => tag.name === name && rel(tag).indexOf(relValue) !== -1);
}

function textOfTag(tag) {
  const match = tag.raw.match(/>([\s\S]*)<\/[a-zA-Z][\w:-]*>$/);
  return match ? stripHtml(match[1]) : '';
}

function normalizeUrl(value, base) {
  if (!value) return '';
  try {
    return new URL(String(value), base || undefined).href;
  } catch (error) {
    return String(value);
  }
}

function samePageUrl(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    left.hash = '';
    right.hash = '';
    let leftPath = left.pathname.replace(/\/index\.html$/, '/');
    let rightPath = right.pathname.replace(/\/index\.html$/, '/');
    return (
      left.protocol === right.protocol &&
      left.host.toLowerCase() === right.host.toLowerCase() &&
      leftPath === rightPath &&
      left.search === right.search
    );
  } catch (error) {
    return String(a) === String(b);
  }
}

function hasTrailingSlashDifference(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return (
      left.host === right.host &&
      left.pathname.replace(/\/$/, '') === right.pathname.replace(/\/$/, '') &&
      left.pathname !== right.pathname
    );
  } catch (error) {
    return false;
  }
}

function extractJsonLd(html) {
  const blocks = [];
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(String(html)))) blocks.push(match[1]);
  return blocks;
}

function collectSchemaTypes(value, types = new Set()) {
  if (!value || typeof value !== 'object') return types;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaTypes(item, types));
    return types;
  }
  const type = value['@type'];
  if (typeof type === 'string') types.add(type);
  if (Array.isArray(type)) type.forEach((item) => types.add(item));
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') collectSchemaTypes(child, types);
  });
  return types;
}

// ---------------------------------------------------------------------------
// Page checks
// ---------------------------------------------------------------------------

function htmlLang(tags) {
  const html = tags.find((tag) => tag.name === 'html');
  return html ? attr(html, 'lang') : null;
}

function metaContent(tags, key, value) {
  const tag = tags.find((item) => {
    if (item.name !== 'meta') return false;
    return (attr(item, key) || '').toLowerCase() === value.toLowerCase();
  });
  return tag ? attr(tag, 'content') : null;
}

function titleOf(html) {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : '';
}

function hreflangLinks(tags, pageUrl) {
  return findTagsByRel(tags, 'link', 'alternate')
    .filter((tag) => attr(tag, 'hreflang'))
    .map((tag) => ({
      lang: attr(tag, 'hreflang').toLowerCase(),
      href: normalizeUrl(attr(tag, 'href'), pageUrl)
    }));
}

function auditPage(audit, page, context) {
  const { tags, html } = page;
  const pageUrl = page.url;
  const isHtml = /html/i.test(page.contentType || 'text/html');
  if (!isHtml) {
    audit.add({
      code: 'page-not-html',
      severity: 'high',
      area: 'content',
      page: pageUrl,
      evidence: 'content-type: ' + (page.contentType || 'unknown'),
      fix: 'Serve HTML for crawlable pages (or document the non-HTML resource as intentional).',
      validation: 'curl -sI <url> | grep -i content-type'
    });
  }
  if (page.status >= 400) {
    audit.add({
      code: 'page-error-status',
      severity: 'critical',
      area: 'crawl',
      page: pageUrl,
      evidence: 'HTTP ' + page.status,
      fix: 'Fix the server/build error or redirect permanently to a working URL.',
      validation: 'curl -sI <url>'
    });
  }

  const title = titleOf(html);
  if (!title) {
    audit.add({
      code: 'title-missing',
      severity: 'high',
      area: 'metadata',
      page: pageUrl,
      evidence: '<title> is missing or empty',
      fix: 'Add a unique, accurate <title> in the page language.',
      validation: 'grep -o "<title>[^<]*" <url>'
    });
  } else if (title.length > 65) {
    audit.add({
      code: 'title-long',
      severity: 'low',
      area: 'metadata',
      page: pageUrl,
      evidence: title.length + ' characters: ' + title.slice(0, 80),
      fix: 'Shorten only if the title can stay accurate; Google may rewrite snippets.',
      validation: 'Re-read the rendered SERP snippet, not a character counter.'
    });
  }

  const description = metaContent(tags, 'name', 'description');
  if (!description || !description.trim()) {
    audit.add({
      code: 'description-missing',
      severity: 'medium',
      area: 'metadata',
      page: pageUrl,
      evidence: '<meta name="description"> is missing or empty',
      fix: 'Write a unique, useful description of the page content.',
      validation: 'grep -o \'name="description" content="[^"]*"\' <url>'
    });
  }

  const viewport = metaContent(tags, 'name', 'viewport');
  if (!viewport) {
    audit.add({
      code: 'viewport-missing',
      severity: 'medium',
      area: 'mobile',
      page: pageUrl,
      evidence: '<meta name="viewport"> is missing',
      fix: 'Add width=device-width, initial-scale=1.',
      validation: 'grep -o \'name="viewport"\' <url>'
    });
  }

  const lang = htmlLang(tags);
  if (!lang) {
    audit.add({
      code: 'lang-missing',
      severity: 'high',
      area: 'international',
      page: pageUrl,
      evidence: '<html> has no lang attribute',
      fix: 'Set <html lang="…"> to the page language.',
      validation: 'grep -o \'<html[^>]*lang="[^"]*"\' <url>'
    });
  } else if (context.expectedLang && !lang.toLowerCase().startsWith(context.expectedLang)) {
    audit.add({
      code: 'lang-mismatch',
      severity: 'medium',
      area: 'international',
      page: pageUrl,
      evidence: 'html lang="' + lang + '", URL suggests "' + context.expectedLang + '"',
      fix: 'Align lang with the URL language and confirm the page text matches.',
      validation: 'grep -o \'<html[^>]*lang="[^"]*"\' <url>'
    });
  }

  const h1s = findTags(tags, 'h1');
  if (h1s.length === 0) {
    audit.add({
      code: 'h1-missing',
      severity: 'high',
      area: 'content',
      page: pageUrl,
      evidence: 'no <h1>',
      fix: 'Add one <h1> that states the page purpose.',
      validation: 'grep -c \'<h1\\b\' <url>'
    });
  } else if (h1s.length > 1) {
    audit.add({
      code: 'h1-multiple',
      severity: 'medium',
      area: 'content',
      page: pageUrl,
      evidence: h1s.length + ' <h1> elements',
      fix: 'Keep one <h1>; demote the others to <h2>.',
      validation: 'grep -c \'<h1\\b\' <url>'
    });
  }

  const canonicals = findTagsByRel(tags, 'link', 'canonical');
  if (canonicals.length === 0) {
    audit.add({
      code: 'canonical-missing',
      severity: 'high',
      area: 'canonical',
      page: pageUrl,
      evidence: 'no <link rel="canonical">',
      fix: 'Add a self-referencing absolute canonical on every indexable page.',
      validation: 'grep -o \'rel="canonical" href="[^"]*"\' <url>'
    });
  } else if (canonicals.length > 1) {
    audit.add({
      code: 'canonical-multiple',
      severity: 'high',
      area: 'canonical',
      page: pageUrl,
      evidence: canonicals.length + ' canonical links',
      fix: 'Keep a single canonical; remove conflicting tags.',
      validation: 'grep -c \'rel="canonical"\' <url>'
    });
  } else {
    const href = normalizeUrl(attr(canonicals[0], 'href'), pageUrl);
    if (!pageUrl.startsWith('file:') && !samePageUrl(href, pageUrl)) {
      const severity = hasTrailingSlashDifference(href, pageUrl) ? 'medium' : 'high';
      audit.add({
        code: 'canonical-not-self',
        severity,
        area: 'canonical',
        page: pageUrl,
        evidence: 'canonical points to ' + href,
        fix: 'Point the canonical at the final URL of this page (or fix the URL policy).',
        validation: 'Compare canonical with the address bar and sitemap URL.'
      });
    }
  }

  const robotsMeta = (metaContent(tags, 'name', 'robots') || '').toLowerCase();
  const xRobots = (page.headers && page.headers['x-robots-tag'] ? page.headers['x-robots-tag'] : '').toLowerCase();
  if (robotsMeta.indexOf('noindex') !== -1 || xRobots.indexOf('noindex') !== -1) {
    audit.add({
      code: 'page-noindex',
      severity: 'high',
      area: 'indexing',
      page: pageUrl,
      evidence: (robotsMeta || xRobots).slice(0, 120),
      fix: 'Remove noindex if this page should rank; otherwise remove it from the sitemap.',
      validation: 'curl -sI <url> | grep -i x-robots-tag; grep -o \'name="robots"[^>]*\' <url>'
    });
  }

  const images = findTags(tags, 'img');
  images.forEach((image) => {
    const src = attr(image, 'src') || '';
    if (!src || src.startsWith('data:')) return;
    if (attr(image, 'alt') === null) {
      audit.add({
        code: 'image-alt-missing',
        severity: 'medium',
        area: 'content',
        page: pageUrl,
        evidence: '<img src="' + src.slice(0, 100) + '"> has no alt attribute',
        fix: 'Add descriptive alt text (or alt="" if the image is decorative).',
        validation: 'Re-run this audit.'
      });
    }
  });
  if (images.length >= 2) {
    const missingDimensions = images.filter(
      (image) => !attr(image, 'width') || !attr(image, 'height')
    ).length;
    if (missingDimensions) {
      audit.add({
        code: 'image-dimensions-missing',
        severity: 'low',
        area: 'performance',
        page: pageUrl,
        evidence: missingDimensions + '/' + images.length + ' images without width/height',
        fix: 'Set intrinsic width/height to prevent layout shift.',
        validation: 'Re-run this audit or inspect CLS.'
      });
    }
  }

  // Render-blocking assets in <head>.
  const headMatch = String(html).match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  // <noscript> fallbacks are not fetched by browsers with JS; do not call them
  // render-blocking. They are still useful for crawlers without JS.
  const headSource = headMatch
    ? headMatch[1].replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    : '';
  const headTags = headMatch ? parseTags(headSource) : [];
  const blockingCss = headTags.filter(
    (tag) => tag.name === 'link' && rel(tag).indexOf('stylesheet') !== -1
  );
  if (blockingCss.length) {
    const href = attr(blockingCss[0], 'href') || '(inline)';
    audit.add({
      code: 'render-blocking-css',
      severity: 'medium',
      area: 'performance',
      page: pageUrl,
      evidence: blockingCss.length + ' stylesheet(s) in <head>, first: ' + href,
      fix: 'Inline critical CSS, or load non-critical CSS asynchronously; verify LCP after.',
      validation: 'PageSpeed Insights render-blocking insight + LCP comparison.'
    });
  }
  const headScripts = headTags.filter(
    (tag) =>
      tag.name === 'script' &&
      attr(tag, 'src') &&
      attr(tag, 'async') === null &&
      attr(tag, 'defer') === null &&
      (attr(tag, 'type') || '').toLowerCase() !== 'module'
  );
  if (headScripts.length) {
    audit.add({
      code: 'render-blocking-js',
      severity: 'medium',
      area: 'performance',
      page: pageUrl,
      evidence: headScripts.length + ' synchronous script(s) in <head>, first: ' + attr(headScripts[0], 'src'),
      fix: 'Add defer/async or move the script out of the critical path.',
      validation: 'PageSpeed Insights render-blocking insight.'
    });
  }
  if (/<style\b[^>]*>[\s\S]{200,}<\/style>/i.test(html)) {
    audit.note(pageUrl + ': inline CSS present (good for the critical path; watch HTML size).');
  }

  const jsonLd = extractJsonLd(html);
  if (!jsonLd.length) {
    audit.add({
      code: 'structured-data-missing',
      severity: 'low',
      area: 'structured-data',
      page: pageUrl,
      evidence: 'no application/ld+json block',
      fix: 'Add Organization/WebSite/WebPage JSON-LD, plus page-type schema where relevant.',
      validation: 'Schema Markup Validator / Rich Results Test.'
    });
  } else {
    jsonLd.forEach((block) => {
      try {
        const parsed = JSON.parse(block);
        const types = Array.from(collectSchemaTypes(parsed));
        page.schemaTypes = page.schemaTypes || [];
        types.forEach((type) => page.schemaTypes.push(type));
      } catch (error) {
        audit.add({
          code: 'structured-data-invalid-json',
          severity: 'high',
          area: 'structured-data',
          page: pageUrl,
          evidence: 'JSON.parse failed: ' + error.message,
          fix: 'Fix the JSON-LD syntax; escape </script> as \\u003c.',
          validation: 'JSON.parse the block content.'
        });
      }
    });
  }

  const ogTitle = metaContent(tags, 'property', 'og:title');
  const ogDescription = metaContent(tags, 'property', 'og:description');
  const ogImage = metaContent(tags, 'property', 'og:image');
  if (!ogTitle || !ogDescription || !ogImage) {
    audit.add({
      code: 'open-graph-incomplete',
      severity: 'medium',
      area: 'social',
      page: pageUrl,
      evidence: 'missing ' + [!ogTitle && 'og:title', !ogDescription && 'og:description', !ogImage && 'og:image'].filter(Boolean).join(', '),
      fix: 'Add complete Open Graph tags including a real 1200x630 image.',
      validation: 'Re-run audit; test with a sharing debugger.'
    });
  }
  if (ogImage && !/^https?:\/\//i.test(ogImage)) {
    audit.add({
      code: 'open-graph-image-relative',
      severity: 'medium',
      area: 'social',
      page: pageUrl,
      evidence: 'og:image is not absolute: ' + ogImage,
      fix: 'Use an absolute https URL for og:image.',
      validation: 'Re-run audit.'
    });
  }
  const ogUrl = metaContent(tags, 'property', 'og:url');
  const canonicalHref = canonicals.length === 1 ? normalizeUrl(attr(canonicals[0], 'href'), pageUrl) : '';
  if (ogUrl && canonicalHref && !samePageUrl(normalizeUrl(ogUrl, pageUrl), canonicalHref)) {
    audit.add({
      code: 'open-graph-url-mismatch',
      severity: 'medium',
      area: 'social',
      page: pageUrl,
      evidence: 'og:url ' + ogUrl + ' != canonical ' + canonicalHref,
      fix: 'Make og:url equal the canonical URL.',
      validation: 'Re-run audit.'
    });
  }
  if (!metaContent(tags, 'name', 'twitter:card')) {
    audit.add({
      code: 'twitter-card-missing',
      severity: 'low',
      area: 'social',
      page: pageUrl,
      evidence: 'no twitter:card meta',
      fix: 'Add twitter:card=summary_large_image when an image exists.',
      validation: 'Re-run audit.'
    });
  }

  const alternates = hreflangLinks(tags, pageUrl);
  if (alternates.length) {
    const codes = alternates.map((item) => item.lang);
    if (!codes.includes('x-default')) {
      audit.add({
        code: 'hreflang-missing-x-default',
        severity: 'high',
        area: 'international',
        page: pageUrl,
        evidence: 'hreflang set: ' + codes.join(', '),
        fix: 'Add x-default pointing at the default/selector page.',
        validation: 'Re-run audit.'
      });
    }
    if (new Set(codes).size !== codes.length) {
      audit.add({
        code: 'hreflang-duplicate-code',
        severity: 'medium',
        area: 'international',
        page: pageUrl,
        evidence: codes.join(', '),
        fix: 'Keep one alternate per language code.',
        validation: 'Re-run audit.'
      });
    }
    const invalidCodes = codes.filter(
      (code) => code !== 'x-default' && !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code)
    );
    if (invalidCodes.length) {
      audit.add({
        code: 'hreflang-invalid-code',
        severity: 'medium',
        area: 'international',
        page: pageUrl,
        evidence: invalidCodes.join(', '),
        fix: 'Use valid language or language-region codes (e.g. fr, pt-BR).',
        validation: 'Re-run audit.'
      });
    }
    const selfLang = (lang || '').toLowerCase().split('-')[0];
    if (selfLang && !alternates.some((item) => item.lang === selfLang || item.lang.startsWith(selfLang))) {
      audit.add({
        code: 'hreflang-missing-self',
        severity: 'medium',
        area: 'international',
        page: pageUrl,
        evidence: 'no self alternate for "' + selfLang + '"',
        fix: 'Include the page itself in its hreflang set.',
        validation: 'Re-run audit.'
      });
    }
  }

  const text = visibleText(html);
  page.wordCount = words(text);
  if (page.wordCount > 0 && page.wordCount < 120) {
    audit.add({
      code: 'content-thin',
      severity: 'low',
      area: 'content',
      page: pageUrl,
      evidence: page.wordCount + ' words of main content',
      fix: 'Add the who/what/how/limits detail readers need, or merge the page.',
      validation: 'Re-read the page against references/content-quality.md.'
    });
  }
}

// ---------------------------------------------------------------------------
// Site-level checks
// ---------------------------------------------------------------------------

function parseRobots(text) {
  const groups = [];
  let current = null;
  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const clean = line.replace(/#.*$/, '').trim();
      if (!clean) return;
      const match = clean.match(/^([a-zA-Z-]+)\s*:\s*(.*)$/);
      if (!match) return;
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === 'user-agent') {
        if (current && current.rules.length) {
          groups.push(current);
          current = null;
        }
        if (!current) current = { agents: [], rules: [] };
        current.agents.push(value.toLowerCase());
      } else if (current && ['allow', 'disallow'].includes(key)) {
        current.rules.push({ type: key, value });
      } else if (current && key === 'sitemap') {
        current.rules.push({ type: 'sitemap', value });
      }
    });
  if (current) groups.push(current);
  return groups;
}

function auditRobots(audit, robots, baseUrl) {
  if (!robots) return;
  if (robots.status === 404) {
    audit.add({
      code: 'robots-missing',
      severity: 'high',
      area: 'crawl-files',
      page: baseUrl + '/robots.txt',
      evidence: 'HTTP 404',
      fix: 'Publish a valid robots.txt at the host root with a Sitemap directive.',
      validation: 'curl -sI <origin>/robots.txt'
    });
    return;
  }
  if (robots.status !== 200) {
    audit.add({
      code: 'robots-status',
      severity: 'high',
      area: 'crawl-files',
      page: baseUrl + '/robots.txt',
      evidence: 'HTTP ' + robots.status,
      fix: 'Serve robots.txt with HTTP 200 and text/plain.',
      validation: 'curl -sI <origin>/robots.txt'
    });
    return;
  }
  const groups = parseRobots(robots.html);
  const wildcard = groups.find((group) => group.agents.includes('*'));
  const blocked = wildcard
    ? wildcard.rules.filter((rule) => rule.type === 'disallow' && (rule.value === '/' || rule.value === ''))
    : [];
  if (wildcard && wildcard.rules.some((rule) => rule.type === 'disallow' && rule.value === '/')) {
    audit.add({
      code: 'robots-blocks-all',
      severity: 'critical',
      area: 'crawl-files',
      page: baseUrl + '/robots.txt',
      evidence: 'wildcard group contains Disallow: /',
      fix: 'Remove the blanket disallow; block only private paths.',
      validation: 'curl -s <origin>/robots.txt'
    });
  }
  const sitemaps = groups.flatMap((group) => group.rules.filter((rule) => rule.type === 'sitemap').map((rule) => rule.value));
  if (!sitemaps.length) {
    audit.add({
      code: 'robots-no-sitemap',
      severity: 'medium',
      area: 'crawl-files',
      page: baseUrl + '/robots.txt',
      evidence: 'no Sitemap directive',
      fix: 'Add Sitemap: <absolute sitemap URL>.',
      validation: 'curl -s <origin>/robots.txt | grep -i sitemap'
    });
  }
  audit.crawlFiles.robots = {
    state: blocked.length ? 'invalid' : 'ok',
    status: robots.status,
    sitemaps,
    groups: groups.length
  };
}

function auditSitemap(audit, sitemap, baseUrl, localContext) {
  if (!sitemap) return;
  if (sitemap.status === 404) {
    audit.add({
      code: 'sitemap-missing',
      severity: 'high',
      area: 'crawl-files',
      page: baseUrl + '/sitemap.xml',
      evidence: 'HTTP 404',
      fix: 'Generate and publish sitemap.xml; list it in robots.txt.',
      validation: 'curl -sI <origin>/sitemap.xml'
    });
    audit.crawlFiles.sitemap = { state: 'missing', status: 404 };
    return;
  }
  const text = sitemap.html || '';
  if (!/<urlset|<sitemapindex/i.test(text)) {
    audit.add({
      code: 'sitemap-invalid-xml',
      severity: 'high',
      area: 'crawl-files',
      page: baseUrl + '/sitemap.xml',
      evidence: 'response does not look like a urlset/sitemapindex',
      fix: 'Serve valid XML with the sitemap namespace.',
      validation: 'XML parser or `xmllint --noout <url>`.'
    });
    audit.crawlFiles.sitemap = { state: 'invalid', status: sitemap.status };
    return;
  }
  const locs = Array.from(text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((match) => match[1]);
  const alternates = Array.from(text.matchAll(/<xhtml:link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/gi));
  if (!locs.length) {
    audit.add({
      code: 'sitemap-empty',
      severity: 'high',
      area: 'crawl-files',
      page: baseUrl + '/sitemap.xml',
      evidence: 'no <loc> entries',
      fix: 'Populate the sitemap or remove it if the site is tiny.',
      validation: 'grep -c "<loc>" <sitemap>'
    });
  }
  const nonAbsolute = locs.filter((loc) => !/^https?:\/\//i.test(loc));
  if (nonAbsolute.length) {
    audit.add({
      code: 'sitemap-relative-urls',
      severity: 'high',
      area: 'crawl-files',
      page: baseUrl + '/sitemap.xml',
      evidence: nonAbsolute.length + ' relative <loc> values, e.g. ' + nonAbsolute[0],
      fix: 'Use absolute canonical URLs in the sitemap.',
      validation: 'Re-run audit.'
    });
  }
  const unique = new Set(locs.map((loc) => loc.replace(/\/$/, '')));
  if (unique.size !== locs.length) {
    audit.add({
      code: 'sitemap-duplicate-urls',
      severity: 'medium',
      area: 'crawl-files',
      page: baseUrl + '/sitemap.xml',
      evidence: locs.length + ' entries, ' + unique.size + ' unique',
      fix: 'Emit each canonical URL once.',
      validation: 'Re-run audit.'
    });
  }
  if (!alternates.length) {
    audit.add({
      code: 'sitemap-no-alternates',
      severity: 'low',
      area: 'crawl-files',
      page: baseUrl + '/sitemap.xml',
      evidence: 'no xhtml:link hreflang alternates',
      fix: 'If the site is multilingual, mirror the head hreflang set in the sitemap.',
      validation: 'Re-run audit after adding alternates.'
    });
  }
  if (localContext && localContext.pageUrls) {
    const missing = locs.filter((loc) => !localContext.pageUrls.has(loc.replace(/\/$/, '')) && !localContext.pageUrls.has(loc));
    if (missing.length) {
      audit.note(
        missing.length + ' sitemap URLs were not audited (increase --max-pages or check them): ' + missing.slice(0, 3).join(', ')
      );
    }
  }
  audit.crawlFiles.sitemap = {
    state: 'ok',
    status: sitemap.status,
    urls: locs.length,
    alternates: alternates.length
  };
}

function auditLlms(audit, llms, baseUrl) {
  if (!llms) return;
  if (llms.status === 404) {
    audit.add({
      code: 'llms-missing',
      severity: 'low',
      area: 'ai-search',
      page: baseUrl + '/llms.txt',
      evidence: 'HTTP 404',
      fix: 'Optional: add a short maintained llms.txt linking canonical pages (see references/crawl-files.md).',
      validation: 'curl -s <origin>/llms.txt'
    });
    audit.crawlFiles.llms = { state: 'missing', status: 404 };
    return;
  }
  if (llms.status === 200) {
    const text = llms.html || '';
    const links = Array.from(text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)).length;
    if (!/^#\s+\S/m.test(text)) {
      audit.add({
        code: 'llms-no-title',
        severity: 'low',
        area: 'ai-search',
        page: baseUrl + '/llms.txt',
        evidence: 'no "# Site" heading',
        fix: 'Start the file with "# <site name>".',
        validation: 'Re-read the file.'
      });
    }
    if (!/^>\s+\S/m.test(text)) {
      audit.add({
        code: 'llms-no-summary',
        severity: 'low',
        area: 'ai-search',
        page: baseUrl + '/llms.txt',
        evidence: 'no "> summary" blockquote',
        fix: 'Add a one-paragraph blockquote describing the site.',
        validation: 'Re-read the file.'
      });
    }
    if (links < 2) {
      audit.add({
        code: 'llms-few-links',
        severity: 'low',
        area: 'ai-search',
        page: baseUrl + '/llms.txt',
        evidence: links + ' links',
        fix: 'Link the key public pages (services/products, languages, contact).',
        validation: 'Re-read the file.'
      });
    }
    audit.crawlFiles.llms = { state: 'ok', status: 200, links };
  }
}

function auditSiteLevel(audit, pages, context) {
  const pageByUrl = new Map();
  pages.forEach((page) => pageByUrl.set(page.url.replace(/\/$/, ''), page));
  const lookup = (url) => pageByUrl.get(url.replace(/\/$/, '')) || null;

  // Duplicate titles and descriptions.
  const titleMap = new Map();
  const descriptionMap = new Map();
  pages.forEach((page) => {
    const tags = page.tags;
    const title = titleOf(page.html);
    if (title) {
      if (titleMap.has(title)) {
        audit.add({
          code: 'title-duplicate',
          severity: 'high',
          area: 'metadata',
          page: page.url,
          evidence: 'same title as ' + titleMap.get(title) + ': ' + title.slice(0, 90),
          fix: 'Give each page a unique title that states its specific purpose.',
          validation: 'Re-run audit.'
        });
      } else titleMap.set(title, page.url);
    }
    const description = metaContent(tags, 'name', 'description');
    if (description) {
      if (descriptionMap.has(description)) {
        audit.add({
          code: 'description-duplicate',
          severity: 'medium',
          area: 'metadata',
          page: page.url,
          evidence: 'same description as ' + descriptionMap.get(description),
          fix: 'Write a distinct description for this page.',
          validation: 'Re-run audit.'
        });
      } else descriptionMap.set(description, page.url);
    }
  });

  // hreflang reciprocity.
  pages.forEach((page) => {
    const alternates = page.alternates || [];
    if (!alternates.length) return;
    alternates.forEach((alternate) => {
      if (alternate.lang === 'x-default') return;
      const target = lookup(alternate.href);
      if (!target) {
        audit.note('hreflang target not audited: ' + alternate.href + ' (from ' + page.url + ')');
        return;
      }
      // Reciprocity is about the link back. Language consistency is covered by
      // the self-alternate and html lang checks; do not skip when lang is missing.
      const reciprocal = (target.alternates || []).some((item) =>
        samePageUrl(item.href, page.url)
      );
      if (!reciprocal) {
        audit.add({
          code: 'hreflang-not-reciprocal',
          severity: 'high',
          area: 'international',
          page: page.url,
          evidence: 'links ' + alternate.href + ' but that page does not link back',
          fix: 'Make the hreflang set reciprocal on both pages.',
          validation: 'Re-run audit.'
        });
      }
    });
  });

  // Internal links resolve (local builds) and are not broken.
  pages.forEach((page) => {
    (page.internalLinks || []).forEach((link) => {
      if (!lookup(link)) {
        audit.add({
          code: 'internal-link-broken',
          severity: 'high',
          area: 'links',
          page: page.url,
          evidence: 'links to ' + link + ' which does not exist in this build',
          fix: 'Fix or remove the link; ensure the target is a canonical URL.',
          validation: 'Re-run audit after rebuilding.'
        });
      }
    });
  });

  // Near-duplicate content.
  const grams = pages
    .filter((page) => page.wordCount > 150)
    .map((page) => ({ page, text: visibleText(page.html).toLowerCase() }));
  for (let i = 0; i < grams.length; i += 1) {
    for (let j = i + 1; j < grams.length; j += 1) {
      const left = shingles(grams[i].text, 5);
      const right = shingles(grams[j].text, 5);
      const similarity = jaccard(left, right);
      if (similarity >= 0.6) {
        audit.duplicatePairs.push({
          a: grams[i].page.url,
          b: grams[j].page.url,
          similarity: Number(similarity.toFixed(2))
        });
        audit.add({
          code: 'content-near-duplicate',
          severity: 'medium',
          area: 'content',
          page: grams[i].page.url,
          evidence: 'similarity ' + similarity.toFixed(2) + ' with ' + grams[j].page.url,
          fix: 'Differentiate the pages or merge them; do not publish near-identical copies.',
          validation: 'Re-run audit.'
        });
      }
    }
  }
}

function shingles(text, size) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let index = 0; index + size <= tokens.length; index += 1) {
    set.add(tokens.slice(index, index + size).join(' '));
  }
  return set;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((value) => {
    if (right.has(value)) intersection += 1;
  });
  return intersection / (left.size + right.size - intersection);
}

// ---------------------------------------------------------------------------
// Directory and URL crawling
// ---------------------------------------------------------------------------

async function walkHtml(dir) {
  const out = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function pageUrlForFile(file, root, base) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const clean = relative.replace(/index\.html$/, '');
  const pathname = '/' + clean;
  if (!base) return 'file://' + path.resolve(file);
  return new URL(pathname, base.endsWith('/') ? base : base + '/').href;
}

function expectedLangFromPath(pageUrl) {
  try {
    const segments = new URL(pageUrl).pathname.split('/').filter(Boolean);
    if (segments.length && /^[a-z]{2}$/.test(segments[0])) return segments[0];
  } catch (error) {
    /* ignore */
  }
  return null;
}

async function loadLocalFile(filePath) {
  try {
    const content = await readFile(filePath);
    return { exists: true, content: content.toString('utf8') };
  } catch (error) {
    return { exists: false, content: '' };
  }
}

async function auditLocalDirectory(audit, dir, options) {
  const root = path.resolve(dir);
  const rootInfo = await stat(root).catch(() => null);
  if (!rootInfo || !rootInfo.isDirectory()) {
    throw new Error('not a directory: ' + root);
  }
  if (!options.base) {
    audit.note('No --base provided: URL-dependent checks (canonical/og:url/hreflang targets) are limited.');
  }
  const files = await walkHtml(root);
  if (!files.length) throw new Error('no .html files under ' + root);
  const selected = files.slice(0, options.maxPages);
  const pageUrls = new Set();
  selected.forEach((file) => {
    const pageUrl = pageUrlForFile(file, root, options.base);
    pageUrls.add(pageUrl);
    pageUrls.add(pageUrl.replace(/\/$/, ''));
  });

  for (const file of selected) {
    const html = await loadLocalFile(file);
    if (!html.exists) continue;
    const pageUrl = pageUrlForFile(file, root, options.base);
    const tags = parseTags(html.content);
    const page = {
      url: pageUrl,
      file,
      html: html.content,
      tags,
      status: 200,
      contentType: 'text/html',
      headers: {},
      alternates: hreflangLinks(tags, pageUrl)
    };
    page.internalLinks = collectInternalLinks(tags, pageUrl, pageUrls, options.base);
    audit.pages.push(page);
    auditPage(audit, page, { expectedLang: expectedLangFromPath(pageUrl) });
  }

  const robots = existsSync(path.join(root, 'robots.txt'))
    ? { status: 200, html: (await loadLocalFile(path.join(root, 'robots.txt'))).content }
    : null;
  const sitemapPath = path.join(root, 'sitemap.xml');
  const sitemap = existsSync(sitemapPath)
    ? { status: 200, html: (await loadLocalFile(sitemapPath)).content }
    : null;
  const llms = existsSync(path.join(root, 'llms.txt'))
    ? { status: 200, html: (await loadLocalFile(path.join(root, 'llms.txt'))).content }
    : null;
  const base = options.base || 'file://' + root;
  auditRobots(audit, robots || { status: 404, html: '' }, base);
  auditSitemap(audit, sitemap || { status: 404, html: '' }, base, {
    pageUrls
  });
  auditLlms(audit, llms, base);
  auditSiteLevel(audit, audit.pages, { base, local: true });
  options.pageUrls = pageUrls;
}

function collectInternalLinks(tags, pageUrl, pageUrls, base) {
  const origin = (() => {
    try {
      return base ? new URL(base).origin : new URL(pageUrl).origin;
    } catch (error) {
      return null;
    }
  })();
  const links = new Set();
  findTags(tags, 'a').forEach((tag) => {
    const href = attr(tag, 'href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    const resolved = normalizeUrl(href, pageUrl);
    if (!resolved) return;
    let parsed;
    try {
      parsed = new URL(resolved);
    } catch (error) {
      return;
    }
    if (origin && parsed.origin !== origin) return;
    parsed.hash = '';
    const key = parsed.href;
    if (pageUrls.has(key) || pageUrls.has(key.replace(/\/$/, ''))) links.add(key);
    else links.add(key);
  });
  return Array.from(links);
}

async function auditRemote(audit, target, options) {
  const start = new URL(target);
  const origin = start.origin;
  const queue = [start.href];
  const queued = new Set(queue);
  const pages = [];

  // Crawl files first.
  const robots = await fetchResource(origin + '/robots.txt', options);
  auditRobots(audit, robots, origin);
  const robotsGroups = robots.status === 200 ? parseRobots(robots.html) : [];
  const sitemapUrls = robotsGroups
    .flatMap((group) => group.rules.filter((rule) => rule.type === 'sitemap'))
    .map((rule) => rule.value);
  const sitemapCandidates = sitemapUrls.length ? sitemapUrls : [origin + '/sitemap.xml'];
  let sitemap = null;
  for (const candidate of sitemapCandidates.slice(0, 3)) {
    const response = await fetchResource(candidate, options);
    if (response.status === 200 && /<(urlset|sitemapindex)/i.test(response.html)) {
      sitemap = response;
      break;
    }
  }
  if (!sitemap) sitemap = { status: 404, html: '' };
  auditSitemap(audit, sitemap, origin, {});
  if (sitemap.status === 200) {
    const locs = Array.from(sitemap.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((match) => match[1]);
    locs.slice(0, options.maxPages).forEach((loc) => {
      if (!queued.has(loc) && loc.startsWith(origin)) {
        queue.push(loc);
        queued.add(loc);
      }
    });
  }
  const llms = await fetchResource(origin + '/llms.txt', options);
  auditLlms(audit, llms, origin);

  // www / http checks.
  if (start.protocol === 'https:' && !start.hostname.startsWith('www.')) {
    const www = await fetchResource('https://www.' + start.hostname + '/', options);
    if (www.status === 200) {
      audit.add({
        code: 'www-duplicate-host',
        severity: 'high',
        area: 'crawl',
        page: origin + '/',
        evidence: 'https://www.' + start.hostname + '/ returns 200 (both hosts serve content)',
        fix: 'Add a permanent 301 from www to the canonical host (or the reverse).',
        owner: 'server',
        validation: 'curl -sI https://www.<host>/ | head -5'
      });
    }
  }

  while (queue.length && pages.length < options.maxPages) {
    const url = queue.shift();
    const response = await fetchResource(url, options);
    if (!response.status) {
      audit.add({
        code: 'page-fetch-failed',
        severity: 'high',
        area: 'crawl',
        page: url,
        evidence: response.error || 'no response',
        fix: 'Confirm the URL is reachable and not rate-limited/blocked.',
        owner: 'server',
        validation: 'curl -sI <url>'
      });
      continue;
    }
    if (!/html/i.test(response.contentType)) {
      if (response.status === 200) continue;
      continue;
    }
    const tags = parseTags(response.html);
    const page = {
      url,
      finalUrl: response.finalUrl,
      html: response.html,
      tags,
      status: response.status,
      headers: response.headers,
      contentType: response.contentType,
      alternates: hreflangLinks(tags, url)
    };
    pages.push(page);
    auditPage(audit, page, { expectedLang: expectedLangFromPath(url) });

    // Enqueue hreflang targets and internal links to reach reciprocity checks.
    (page.alternates || []).forEach((alternate) => {
      try {
        const parsed = new URL(alternate.href);
        if (parsed.origin === origin && !queued.has(parsed.href)) {
          queue.push(parsed.href);
          queued.add(parsed.href);
        }
      } catch (error) {
        /* ignore invalid */
      }
    });
    findTags(tags, 'a').forEach((tag) => {
      const href = attr(tag, 'href');
      if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
      try {
        const parsed = new URL(href, url);
        if (parsed.origin !== origin) return;
        parsed.hash = '';
        if (!queued.has(parsed.href) && queue.length + pages.length < options.maxPages * 3) {
          queue.push(parsed.href);
          queued.add(parsed.href);
        }
      } catch (error) {
        /* ignore */
      }
    });
  }
  audit.pages = pages;
  auditSiteLevel(audit, pages, { base: origin, local: false });

  // Header checks on the primary document and one asset.
  const home = pages[0];
  if (home) {
    if (!/content-encoding/i.test(Object.keys(home.headers).join(','))) {
      audit.add({
        code: 'server-no-compression',
        severity: 'medium',
        area: 'performance',
        page: home.url,
        evidence: 'no Content-Encoding header on the HTML document',
        fix: 'Enable brotli/gzip at the server/CDN for HTML, CSS, JS, JSON, SVG.',
        owner: 'server',
        validation: "curl -sI -H 'Accept-Encoding: br, gzip' <url> | grep -i content-encoding"
      });
    }
    const cacheControl = home.headers['cache-control'] || '';
    if (!cacheControl) {
      audit.add({
        code: 'html-no-cache-control',
        severity: 'low',
        area: 'performance',
        page: home.url,
        evidence: 'no Cache-Control on the HTML document',
        fix: 'Let HTML revalidate (`no-cache`/`max-age=0`); version and cache assets long.',
        owner: 'server',
        validation: 'curl -sI <url> | grep -i cache-control'
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderMarkdown(audit, target) {
  const summary = audit.summary();
  const lines = [];
  lines.push('# SEO audit — ' + target);
  lines.push('');
  lines.push('Generated: ' + audit.startedAt + ' · seo-audit v' + VERSION);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('- Pages audited: **' + summary.pages + '**');
  lines.push('- Findings: ' + SEVERITIES.map((severity) => summary.findings[severity] + ' ' + severity).join(', '));
  lines.push('- Crawl files: robots=' + summary.crawlFiles.robots + ', sitemap=' + summary.crawlFiles.sitemap + ', llms=' + summary.crawlFiles.llms);
  lines.push('');
  const firstFix = audit.findings.find((finding) => ['critical', 'high'].includes(finding.severity));
  if (firstFix) {
    lines.push('## Start with');
    lines.push('');
    lines.push('1. ' + firstFix.code + ' — ' + firstFix.fix + ' (' + firstFix.page + ')');
    const second = audit.findings.filter((finding) => ['critical', 'high'].includes(finding.severity))[1];
    if (second) lines.push('2. ' + second.code + ' — ' + second.fix + ' (' + second.page + ')');
    const third = audit.findings.filter((finding) => ['critical', 'high'].includes(finding.severity))[2];
    if (third) lines.push('3. ' + third.code + ' — ' + third.fix + ' (' + third.page + ')');
    lines.push('');
  }
  lines.push('## Findings');
  lines.push('');
  if (!audit.findings.length) {
    lines.push('No findings. Re-run after changes and validate manually.');
  } else {
    audit.findings.forEach((finding) => {
      lines.push(
        '### [' + finding.severity + '] ' + finding.code + ' — ' + finding.page
      );
      lines.push('');
      lines.push('- Evidence: ' + finding.evidence);
      lines.push('- Fix: ' + finding.fix);
      lines.push('- Owner: ' + finding.owner);
      lines.push('- Validation: ' + finding.validation);
      lines.push('');
    });
  }
  if (audit.duplicatePairs.length) {
    lines.push('## Near-duplicate pairs');
    lines.push('');
    audit.duplicatePairs.forEach((pair) => {
      lines.push('- ' + pair.a + ' ↔ ' + pair.b + ' (' + pair.similarity + ')');
    });
    lines.push('');
  }
  if (audit.notes.length) {
    lines.push('## Notes and limitations');
    lines.push('');
    audit.notes.forEach((note) => lines.push('- ' + note));
    lines.push('');
  }
  lines.push('Read-only audit. Lab findings are not field Core Web Vitals. Fix server-owned');
  lines.push('items (compression, cache TTLs, redirects) on the host, not in the page HTML.');
  return lines.join('\n') + '\n';
}

function renderJson(audit, target) {
  return JSON.stringify(
    {
      version: VERSION,
      generatedAt: audit.startedAt,
      target,
      summary: audit.summary(),
      crawlFiles: audit.crawlFiles,
      pages: audit.pages.map((page) => ({
        url: page.url,
        status: page.status,
        title: titleOf(page.html || ''),
        wordCount: page.wordCount || 0
      })),
      findings: audit.findings,
      nearDuplicates: audit.duplicatePairs,
      notes: audit.notes
    },
    null,
    2
  ) + '\n';
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { command: null, target: null, options: {} };
  const options = {
    json: false,
    out: null,
    base: null,
    maxPages: 40,
    timeout: 15000,
    userAgent: DEFAULT_UA,
    failOn: null,
    quiet: false
  };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--json':
        options.json = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--out':
        options.out = argv[++index];
        break;
      case '--base':
        options.base = argv[++index];
        break;
      case '--max-pages':
        options.maxPages = Number(argv[++index]) || options.maxPages;
        break;
      case '--timeout':
        options.timeout = Number(argv[++index]) || options.timeout;
        break;
      case '--user-agent':
        options.userAgent = argv[++index] || options.userAgent;
        break;
      case '--fail-on':
        options.failOn = argv[++index];
        break;
      default:
        rest.push(arg);
    }
  }
  args.command = rest[0] || null;
  args.target = rest[1] || null;
  args.options = options;
  return args;
}

function printHelp() {
  process.stdout.write(`seo-audit v${VERSION} — dependency-free SEO auditor

Usage:
  node seo-audit.mjs audit <url|dir> [options]
  node seo-audit.mjs page <url|dir/page.html> [options]
  node seo-audit.mjs crawl-files <url|dir> [options]

Examples:
  node seo-audit.mjs audit https://example.com
  node seo-audit.mjs audit ./dist --base https://example.com
  node seo-audit.mjs audit https://example.com --json --out report.json
  node seo-audit.mjs audit ./dist --base https://example.com --fail-on high

Options:
  --json               JSON output
  --out <file>         Write the report to a file
  --base <url>         Base URL for local builds
  --max-pages <n>      Page cap (default 40)
  --timeout <ms>       Request timeout (default 15000)
  --user-agent <ua>    Crawler user agent
  --fail-on <sev>      critical|high|medium|low (exit 1 when matched)
  --quiet              No progress output
  --help               This help
`);
}

async function main() {
  const { command, target, options } = parseArgs(process.argv.slice(2));
  if (options.help || !command) {
    printHelp();
    process.exit(options.help ? 0 : 2);
  }
  if (!target) {
    process.stderr.write('Missing target. Try --help.\n');
    process.exit(2);
  }
  const validCommands = ['audit', 'page', 'crawl-files'];
  if (!validCommands.includes(command)) {
    process.stderr.write('Unknown command "' + command + '". Try --help.\n');
    process.exit(2);
  }
  const targetIsUrl = /^https?:\/\//i.test(target);
  const isDirectory = !targetIsUrl && existsSync(target) && (await stat(target)).isDirectory();
  const isFile = !targetIsUrl && existsSync(target) && (await stat(target)).isFile();

  const audit = new Audit(options);
  try {
    if (command === 'page') {
      if (isFile) {
        const root = path.dirname(target);
        const html = (await loadLocalFile(target)).content;
        const pageUrl = options.base
          ? new URL(path.basename(target).replace(/index\.html$/, ''), options.base.endsWith('/') ? options.base : options.base + '/').href
          : 'file://' + path.resolve(target);
        const tags = parseTags(html);
        const page = {
          url: pageUrl,
          html,
          tags,
          status: 200,
          headers: {},
          contentType: 'text/html',
          alternates: hreflangLinks(tags, pageUrl)
        };
        page.internalLinks = collectInternalLinks(tags, pageUrl, new Set(), options.base);
        audit.pages.push(page);
        auditPage(audit, page, { expectedLang: expectedLangFromPath(pageUrl) });
      } else if (isDirectory) {
        await auditLocalDirectory(audit, target, options);
      } else if (targetIsUrl) {
        await auditRemote(audit, target, options);
      } else {
        throw new Error('target not found: ' + target);
      }
    } else if (command === 'crawl-files') {
      if (isDirectory) {
        const root = path.resolve(target);
        const base = options.base || 'file://' + root;
        const robots = existsSync(path.join(root, 'robots.txt'))
          ? { status: 200, html: (await loadLocalFile(path.join(root, 'robots.txt'))).content }
          : { status: 404, html: '' };
        const sitemap = existsSync(path.join(root, 'sitemap.xml'))
          ? { status: 200, html: (await loadLocalFile(path.join(root, 'sitemap.xml'))).content }
          : { status: 404, html: '' };
        const llms = existsSync(path.join(root, 'llms.txt'))
          ? { status: 200, html: (await loadLocalFile(path.join(root, 'llms.txt'))).content }
          : { status: 404, html: '' };
        auditRobots(audit, robots, base);
        auditSitemap(audit, sitemap, base, {});
        auditLlms(audit, llms, base);
      } else if (targetIsUrl) {
        const origin = new URL(target).origin;
        const robots = await fetchResource(origin + '/robots.txt', options);
        auditRobots(audit, robots, origin);
        const groups = robots.status === 200 ? parseRobots(robots.html) : [];
        const sitemapUrls = groups
          .flatMap((group) => group.rules.filter((rule) => rule.type === 'sitemap'))
          .map((rule) => rule.value);
        let sitemap = { status: 404, html: '' };
        for (const candidate of (sitemapUrls.length ? sitemapUrls : [origin + '/sitemap.xml']).slice(0, 3)) {
          const response = await fetchResource(candidate, options);
          if (response.status === 200) {
            sitemap = response;
            break;
          }
        }
        auditSitemap(audit, sitemap, origin, {});
        const llms = await fetchResource(origin + '/llms.txt', options);
        auditLlms(audit, llms, origin);
      } else {
        throw new Error('target not found: ' + target);
      }
    } else if (isDirectory) {
      await auditLocalDirectory(audit, target, options);
    } else if (targetIsUrl) {
      await auditRemote(audit, target, options);
    } else {
      throw new Error('target not found: ' + target);
    }

    const rendered = options.json ? renderJson(audit, target) : renderMarkdown(audit, target);
    if (options.out) {
      await writeFile(path.resolve(options.out), rendered, 'utf8');
      if (!options.quiet) process.stderr.write('Report written to ' + path.resolve(options.out) + '\n');
    }
    process.stdout.write(rendered);

    if (options.failOn) {
      const threshold = SEVERITY_RANK[options.failOn.toLowerCase()];
      if (threshold === undefined) {
        process.stderr.write('Invalid --fail-on value; use critical|high|medium|low.\n');
        process.exit(2);
      }
      const worst = audit.findings.reduce(
        (max, finding) => Math.max(max, SEVERITY_RANK[finding.severity] || 0),
        0
      );
      if (worst >= threshold) {
        process.stderr.write(
          'Failing: findings at or above "' + options.failOn + '" (' + audit.findings.length + ' total).\n'
        );
        process.exit(1);
      }
    }
  } catch (error) {
    process.stderr.write('seo-audit failed: ' + (error && error.message ? error.message : String(error)) + '\n');
    process.exit(2);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

export { auditPage, auditSiteLevel, parseTags, parseRobots, visibleText, words, renderMarkdown };
