# Publishing the npx command

The repository is already usable with `npx` from GitHub:

```bash
npx -y github:AJN-Tech/seo-skill
```

To get the shorter `npx -y seo-skill` (npm registry) command, publish the package.
The npm name `seo-skill` was available at the time of writing.

## One-time setup

```bash
npm login                      # or: npm login --auth-type=web
npm whoami                     # confirm the account
```

If you use a CI token instead:

```bash
export NPM_TOKEN=...           # automation token with publish rights
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
```

## Publish

```bash
git clone https://github.com/AJN-Tech/seo-skill.git
cd seo-skill
npm run check                  # tests + skill validation + shell/JS syntax
npm pack --dry-run             # inspect the package contents
npm publish                    # unscoped package (name: seo-skill)
```

`package.json` already has:

- `bin.seo-skill` → `bin/seo-skill.mjs` (the npx command);
- `files` → only the skill, references, scripts, docs and metadata;
- `publishConfig.access: public` (for a scoped name, change `name` to
  `@your-scope/seo-skill` and keep `publishConfig`);
- `engines.node >= 18`.

## Verify the published command

```bash
npx -y seo-skill --version
npx -y seo-skill check
npx -y seo-skill audit https://example.com --max-pages 5
```

## Versioning

- Bump `version` in `package.json`, add a `CHANGELOG.md` entry.
- Commit, `git tag -a vX.Y.Z -m "seo-skill vX.Y.Z"`, `git push origin vX.Y.Z`.
- `gh release create vX.Y.Z --title ... --notes ...` (GitHub release).
- `npm publish` (npm registry). Keep both artifacts in sync.

## Troubleshooting

- `E404` on publish: the name is taken or the account lacks access. Choose a scoped
  name (`@your-scope/seo-skill`) or a different name.
- `E403`/`ENEEDAUTH`: run `npm login` again or fix the token.
- `npx` still runs an old build: `npx -y seo-skill@latest` or clear the npm cache.
