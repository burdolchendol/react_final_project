import { test } from "node:test";
import assert from "node:assert/strict";
import { secUserAgent } from "../scripts/providers/secEdgar.mjs";

test("secUserAgent requires a contact email", () => {
  const saved = process.env.SEC_USER_AGENT;
  try {
    delete process.env.SEC_USER_AGENT;
    assert.throws(secUserAgent, /SEC_USER_AGENT is not set/);
    process.env.SEC_USER_AGENT = "Just A Name";
    assert.throws(secUserAgent, /SEC_USER_AGENT is not set/);
    process.env.SEC_USER_AGENT = " Jane Doe jane@example.com ";
    assert.equal(secUserAgent(), "Jane Doe jane@example.com");
  } finally {
    if (saved === undefined) delete process.env.SEC_USER_AGENT;
    else process.env.SEC_USER_AGENT = saved;
  }
});
