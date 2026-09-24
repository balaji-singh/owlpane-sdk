#!/usr/bin/env node
/**
 * Ensures sdk-v* release tag matches npm, PyPI, and Go module version fields.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const refName = process.env.GITHUB_REF_NAME || "";

const nodeV = JSON.parse(
  fs.readFileSync(path.join(root, "packages/node/package.json"), "utf8"),
).version;
const browserV = JSON.parse(
  fs.readFileSync(path.join(root, "packages/browser/package.json"), "utf8"),
).version;
const pyToml = fs.readFileSync(
  path.join(root, "packages/python/pyproject.toml"),
  "utf8",
);
const pyMatch = pyToml.match(/^version\s*=\s*"([^"]+)"/m);
const pyV = pyMatch?.[1];
if (!pyV) {
  console.error("could not read version from packages/python/pyproject.toml");
  process.exit(1);
}

const javaPom = fs.readFileSync(
  path.join(root, "packages/java/pom.xml"),
  "utf8",
);
const javaMatch = javaPom.match(
  /<artifactId>owlpane-java<\/artifactId>\s*\n\s*<version>([^<]+)<\/version>/,
);
const javaV = javaMatch?.[1];
const rubyVer = fs.readFileSync(
  path.join(root, "packages/ruby/lib/owlpane/version.rb"),
  "utf8",
);
const rubyMatch = rubyVer.match(/VERSION = "([^"]+)"/);
const rubyV = rubyMatch?.[1];

const expected = nodeV;
const mismatches = [];
if (browserV !== expected) mismatches.push(`browser=${browserV}`);
if (pyV !== expected) mismatches.push(`python=${pyV}`);
if (javaV !== expected) mismatches.push(`java=${javaV}`);
if (rubyV !== expected) mismatches.push(`ruby=${rubyV}`);

if (mismatches.length) {
  console.error(
    `version mismatch: node=${expected}; ${mismatches.join("; ")}`,
  );
  process.exit(1);
}

if (refName.startsWith("sdk-v")) {
  const tagV = refName.slice("sdk-v".length);
  if (tagV !== expected) {
    console.error(`tag ${refName} does not match package version ${expected}`);
    process.exit(1);
  }
}

console.log(
  `release version ${expected} (node, browser, python, java, ruby aligned)`,
);
