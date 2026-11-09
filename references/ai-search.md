# AI search, AI crawlers and llms.txt

AI surfaces (AI Overviews, ChatGPT search, Perplexity, Copilot, Gemini, Claude) create
a second discovery channel. The technical decisions are narrow; the content decisions
are the same as classic SEO: be accurate, be crawlable, be citable.

## Separate the two decisions

| Decision | Who crawls | Typical choice |
| --- | --- | --- |
| AI **search/answer** crawlers may read the site | OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Gemini-DeepResearch | Allow, so the site can be cited |
| AI **model-training** crawlers may collect content | GPTBot, CCBot, Google-Extended, Applebot-Extended, ClaudeBot, anthropic-ai, Bytespider | Often opted out; a business/legal decision |

Encode both explicitly in robots.txt (see `crawl-files.md`). Explain in the report that
this is a publishing decision and that robots.txt is not access control. User-agent
lists change; verify current names and keep the file editable.

## What actually helps AI citation

- Crawlable HTML with the answer present in text (not only in an image or JS widget).
- Clear entity/author/about information, consistent names and URLs.
- Original, specific facts and first-hand detail that summaries cannot invent.
- Structured data that matches the visible page.
- Stable URLs and clean language variants (`/fr/`, `/en/`) with hreflang.
- A short, accurate `llms.txt` that links canonical pages (optional, low cost).
- Fast, server-rendered pages; AI crawlers have timeouts too.

## What does not work

- Hidden text, prompt injection, or instructions aimed at AI systems.
- Keyword-stuffed "AI summaries" duplicated across pages.
- Fake statistics or fabricated expertise (models repeat and amplify them).
- Blocking AI search crawlers while expecting citations.
- Paying for "GEO" guarantees; no one controls AI answers.

## Measuring AI visibility (be careful)

- There is no official rank tracker for AI answers. You can sample prompts manually,
  record the query/date/locale/model, and note whether the brand/page is cited.
- Referral traffic from AI tools appears in analytics as new referrers (chatgpt.com,
  perplexity.ai, copilot.microsoft.com, gemini.google.com); tag/segment it.
- Search Console shows search demand, not AI citations.
- Treat all AI-visibility claims as sampled observations, not ranking data.

## llms.txt in one paragraph

A Markdown summary at `/llms.txt` with: `# Site`, a one-paragraph `>` description, what
the company does, who it serves, grouped links to accurate public pages, languages, and
contact/sitemap. Keep it small and update it with the catalog. It is a proposed
convention, not a standard Google ranking factor; ship it because it is cheap and
useful, not as a silver bullet.

## Content rules for AI-era SEO

- Answer the question in the first paragraph, then add depth.
- Use headings that match real questions.
- Include specifics: who, what, where, limits, next step.
- Keep facts consistent across pages and languages.
- Cite sources for claims, and date time-sensitive content.
- Do not publish fake expertise; involve real practitioners for regulated topics.

## Reporting AI work

In the report, separate:
1. Crawl policy changes (robots groups, verified user agents).
2. Discoverability assets (llms.txt, structured data, language versions).
3. Content changes that improve citability.
4. Sampled AI visibility observations with method and limitations.
Never promise "AI rankings".
