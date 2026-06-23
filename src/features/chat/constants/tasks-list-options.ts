import type { TaskRow } from "~/features/chat/schemas/task-list-schema";

export const PRIORITY_FILTERS = ["all", "high", "medium", "low"] as const satisfies readonly (
  | TaskRow["priority"]
  | "all"
)[];

export const SORTS = ["default", "priority", "title"] as const satisfies readonly string[];

export const SORT_LABELS = {
  default: "並び順: 既定",
  priority: "並び順: 優先度",
  title: "並び順: タイトル",
} as const satisfies Record<(typeof SORTS)[number], string>;

export const PRIORITY_FILTER_LABELS = {
  all: "優先度: すべて",
  high: "優先度: high",
  medium: "優先度: medium",
  low: "優先度: low",
} as const satisfies Record<(typeof PRIORITY_FILTERS)[number], string>;
