# Installing Owlpane SDKs in customer apps

Customers import **`@owlpane/node`** and **`@owlpane/browser`**. Packages are published from this repo on every `sdk-v*` tag.

## npmjs.com (preferred when `NPM_TOKEN` is configured in CI)

```bash
npm install @owlpane/node @owlpane/browser
```

## GitHub Packages (default until npm automation token is added)

Published as `@balaji-singh/owlpane-node` and `@balaji-singh/owlpane-browser`. Use npm **aliases** so imports stay `@owlpane/*`:

```json
{
  "dependencies": {
    "@owlpane/node": "npm:@balaji-singh/owlpane-node@0.1.3",
    "@owlpane/browser": "npm:@balaji-singh/owlpane-browser@0.1.3"
  }
}
```

Repo root `.npmrc` (commit this; do not commit tokens):

```ini
@balaji-singh:registry=https://npm.pkg.github.com
```

CI and Docker builds need read access to GitHub Packages. For private packages, set `NODE_AUTH_TOKEN` to a `read:packages` PAT or `GITHUB_TOKEN` in GitHub Actions.

After packages are public on GitHub Packages, `npm ci` works without a token.
