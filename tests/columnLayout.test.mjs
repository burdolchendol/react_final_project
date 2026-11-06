import test from "node:test";
import assert from "node:assert/strict";
import { orderColumns, moveColumn, clampWidth } from "../src/final_project/utils/columnLayout.js";

test("orderColumns keeps the saved order and slots in new columns", () => {
  assert.deepEqual(orderColumns(["a", "b", "c"], null), ["a", "b", "c"]);
  assert.deepEqual(orderColumns(["a", "b", "c"], ["c", "a", "b"]), ["c", "a", "b"]);
  // "x" is new and follows "b" by default; "gone" no longer exists.
  assert.deepEqual(orderColumns(["a", "b", "x", "c"], ["c", "gone", "b", "a"]), ["c", "b", "x", "a"]);
  assert.deepEqual(orderColumns(["x", "a"], ["a"]), ["x", "a"]);
});

test("moveColumn moves before a column or to the end", () => {
  assert.deepEqual(moveColumn(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  assert.deepEqual(moveColumn(["a", "b", "c"], "a", null), ["b", "c", "a"]);
  assert.deepEqual(moveColumn(["a", "b", "c"], "b", "b"), ["a", "b", "c"]);
});

test("clampWidth keeps widths usable", () => {
  assert.equal(clampWidth(10), 60);
  assert.equal(clampWidth(150.4), 150);
  assert.equal(clampWidth(9999), 480);
});
