# Installing Owlpane SDKs in customer apps

Customers install from the **public npm registry** — no GitHub token or `.npmrc` required.

```bash
npm install @owlpane/node @owlpane/browser
```

Pin a version in `package.json`:

```json
{
  "dependencies": {
    "@owlpane/node": "^0.1.3",
    "@owlpane/browser": "^0.1.3"
  }
}
```

## Publishing (maintainers)

Releases are published on every `sdk-v*` tag from [owlpane-sdk](https://github.com/balaji-singh/owlpane-sdk) via `.github/workflows/publish-sdk.yml`.

- Add **`NPM_TOKEN`** (npm automation token with publish access to the **`@owlpane`** scope) in the repo secrets.
- Create the **`@owlpane`** org on [npmjs.com](https://www.npmjs.com) and grant the token publish rights before the first release.

Legacy GitHub Packages (`@balaji-singh/owlpane-*`) is no longer used for Node/Browser.
