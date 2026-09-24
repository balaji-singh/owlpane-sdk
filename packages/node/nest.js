// Compatibility shim for TS "node10"/classic module resolution, which does not read package.json
// "exports" subpaths. Modern resolvers (node16/nodenext/bundler) use the "exports" map instead and
// never load this file. Keep in sync with the "exports" map in package.json.
module.exports = require("./dist/nest");
