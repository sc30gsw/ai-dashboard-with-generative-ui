import { z } from "zod";

const taskSuggestionItemSchema = z.object({
  id: z.string().describe("Task id"),
  title: z.string().describe("Task title"),
  priority: z.enum(["low", "medium", "high"]).describe("Priority level"),
  location: z
    .enum(["indoor", "outdoor"])
    .nullable()
    .describe("Where the task takes place, or null if not location-specific"),
  reason: z.string().describe("Short explanation for this item's position, e.g. weather-driven"),
});

export const taskSuggestionPropsSchema = z.object({
  items: z
    .array(taskSuggestionItemSchema)
    .describe("Weather-aware suggested task order, ranked in display order"),
});

export type TaskSuggestionItem = z.infer<typeof taskSuggestionItemSchema>;
