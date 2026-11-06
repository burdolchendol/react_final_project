import test from "node:test";
import assert from "node:assert/strict";
import { grahamVerdict } from "../src/final_project/utils/rules.js";

test("grahamVerdict", () => {
  assert.equal(grahamVerdict(null, 1), "No estimate");
  assert.equal(grahamVerdict(-0.1, 1), "Overpriced");
  assert.equal(grahamVerdict(0.3, 0.8), "Value buy");
  assert.equal(grahamVerdict(0.3, 0.5), "Watch");
  assert.equal(grahamVerdict(0.1, 1), "Watch");
});
