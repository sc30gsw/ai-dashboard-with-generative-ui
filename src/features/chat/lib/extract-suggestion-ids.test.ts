import { expect, test } from "vite-plus/test";

import { extractSuggestionOrderedIds } from "~/features/chat/lib/extract-suggestion-ids";

test("returns an empty array when no TaskSuggestion node is present", () => {
  expect(extractSuggestionOrderedIds('root = TextContent("hello")')).toEqual([]);
});

test("extracts ids in order from a TaskSuggestion node", () => {
  const text = [
    "root = TaskSuggestion(items=[",
    '{id: "t2", title: "洗濯物を干す", priority: "high", location: "outdoor", reason: "午前中は晴れ"},',
    '{id: "t1", title: "報告書を作成", priority: "medium", location: "indoor", reason: "屋内作業を優先"}',
    "])",
  ].join("\n");

  expect(extractSuggestionOrderedIds(text)).toEqual(["t2", "t1"]);
});

test("ignores ids that appear before the TaskSuggestion node", () => {
  const text =
    'Card([TextContent("id: \\"decoy\\"")]) \nroot = TaskSuggestion(items=[{id: "t1", title: "x", priority: "low", location: null, reason: "y"}])';

  expect(extractSuggestionOrderedIds(text)).toEqual(["t1"]);
});

test("ignores ids that appear in an unrelated node following a balanced TaskSuggestion node", () => {
  const text = [
    "root = TaskSuggestion(items=[",
    '{id: "t1", title: "報告書を作成", priority: "medium", location: "indoor", reason: "屋内作業を優先"}',
    "])",
    'Card([TextContent("id: \\"decoy\\"")])',
  ].join("\n");

  expect(extractSuggestionOrderedIds(text)).toEqual(["t1"]);
});
