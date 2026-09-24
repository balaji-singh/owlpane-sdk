import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { start, traceUserProfileEnabled } from "../src/index.js";

describe("trace user profile opt-in", () => {
  it("is off by default when start has no endpoint", () => {
    start({ traceUserProfile: false });
    assert.equal(traceUserProfileEnabled(), false);
  });

  it("honours traceUserProfile option even without a configured endpoint", () => {
    start({ traceUserProfile: true });
    assert.equal(traceUserProfileEnabled(), true);
  });
});
