import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const owner = process.env.GITHUB_REPOSITORY_OWNER || "balaji-singh";
const registry =
  process.env.NPM_CONFIG_REGISTRY || "https://npm.pkg.github.com";
const tag = process.env.GITHUB_REF_NAME || "";

function publishOne(workspace, publishName) {
  const dir = path.join(root, workspace);
  const src = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(src, "utf8"));
  const version = pkg.version;
  if (tag) {
    const expected = `sdk-v${version}`;
    if (tag !== expected) {
      throw new Error(
        `Tag ${tag} does not match ${workspace} version ${version} (expected ${expected})`,
      );
    }
  }

  const tmp = fs.mkdtempSync(path.join(root, ".publish-sdk-"));
  fs.cpSync(path.join(dir, "dist"), path.join(tmp, "dist"), { recursive: true });
  for (const f of ["LICENSE", "README.md", "nest.js", "nest.d.ts"]) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(tmp, f));
  }

  const out = {
    ...pkg,
    name: publishName,
    repository: {
      type: "git",
      url: `git+https://github.com/${owner}/owlpane-sdk.git`,
      directory: workspace,
    },
    publishConfig: { registry: "https://npm.pkg.github.com" },
  };
  delete out.private;
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify(out, null, 2));

  execSync(`npm publish --registry=${registry}`, {
    cwd: tmp,
    stdio: "inherit",
    env: process.env,
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Published ${publishName}@${version} to ${registry}`);
}

publishOne("packages/node", `@${owner}/owlpane-node`);
publishOne("packages/browser", `@${owner}/owlpane-browser`);
