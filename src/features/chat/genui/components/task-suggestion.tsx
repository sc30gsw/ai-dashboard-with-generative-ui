import { Button, Card, Chip } from "@heroui/react";
import {
  type ComponentRenderProps,
  defineComponent,
  useTriggerAction,
} from "@openuidev/react-lang";

import {
  type TaskSuggestionItem,
  taskSuggestionPropsSchema,
} from "~/features/chat/schemas/task-suggestion-schema";
import { PriorityChip } from "~/features/tasks/components/priority-chip";

const LOCATION_LABEL = {
  indoor: "屋内",
  outdoor: "屋外",
} as const satisfies Record<NonNullable<TaskSuggestionItem["location"]>, string>;

export const taskSuggestion = defineComponent({
  component: function TaskSuggestionView({
    props,
  }: ComponentRenderProps<Record<"items", TaskSuggestionItem[]>>) {
    const { items } = props;
    const triggerAction = useTriggerAction();
    const orderedIds = items.map((item) => item.id);

    return (
      <Card>
        <Card.Header>
          <Card.Title>おすすめの順序</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li className="flex flex-col gap-1 rounded-md border p-3" key={item.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted text-sm">{index + 1}.</span>
                  <span className="font-medium">{item.title}</span>
                  <PriorityChip priority={item.priority} />
                  {item.location === null ? null : (
                    <Chip color="default" size="sm" variant="secondary">
                      <Chip.Label>{LOCATION_LABEL[item.location]}</Chip.Label>
                    </Chip>
                  )}
                </div>
                <p className="text-muted text-sm">{item.reason}</p>
              </li>
            ))}
          </ol>
          <Button
            className="w-fit"
            onPress={() => {
              triggerAction(
                `この提案の順序を適用してください。reorder_tasks を次の orderedIds でそのまま呼び出してください: ${JSON.stringify(orderedIds)}`,
              );
            }}
            size="sm"
            variant="primary"
          >
            この順序を適用
          </Button>
        </Card.Content>
      </Card>
    );
  },
  description:
    "Shows a weather-aware suggested task order with a reason per item. Emit at ROOT, not wrapped in Card.",
  name: "TaskSuggestion",
  props: taskSuggestionPropsSchema,
});
