import { Droplet, Umbrella } from "@gravity-ui/icons";
import { Button, Card, Chip } from "@heroui/react";
import {
  type ComponentRenderProps,
  defineComponent,
  useTriggerAction,
} from "@openuidev/react-lang";

import {
  type TaskSuggestionItem,
  type TaskSuggestionWeather,
  taskSuggestionPropsSchema,
} from "~/features/chat/schemas/task-suggestion-schema";
import { PriorityChip } from "~/features/tasks/components/priority-chip";
import { WeatherCodeIcon } from "~/features/weather/components/weather-code-icon";

const LOCATION_LABEL = {
  indoor: "屋内",
  outdoor: "屋外",
} as const satisfies Record<NonNullable<TaskSuggestionItem["location"]>, string>;

//? OpenUI の Query() 解決パイプラインは JSON Schema の "format: date" ヒントを見て
//? 文字列を実 Date インスタンスへ自動変換することがある（コンポーネント側の Zod スキーマは
//? z.string() のままでも、そのバリデーションを再度通らない場合がある）。Date を直接 JSX の
//? 子要素として描画すると React が例外を投げるため、表示直前に文字列へ正規化する。
//? 宣言上の型は string だが実行時に Date が来得るため、引数型を緩めて instanceof で判定する。
function toDateLabel(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export const taskSuggestion = defineComponent({
  component: function TaskSuggestionView({
    props,
  }: ComponentRenderProps<{ items: TaskSuggestionItem[]; weather?: TaskSuggestionWeather }>) {
    const { weather } = props;
    //? OpenUI の Query() はホイスト中（実データ到着前）に必須配列プロパティへ null を渡すことがある
    //? （task-list.tsx / weather-widget.tsx と同様のガード）。
    const items = props.items ?? [];
    const triggerAction = useTriggerAction();
    const orderedIds = items.map((item) => item.id);
    const weatherDateLabel = weather == null ? null : toDateLabel(weather.date);

    return (
      <Card>
        <Card.Header>
          <Card.Title>おすすめの順序</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          {/* OpenUI の Query() はホイスト中（実データ到着前）に null を渡すことがある。
              weather はスキーマ上 optional（undefined）だが、ストリーミング中の一時状態は
              スキーマ適用外で null になり得るため、両方を弾く。
              加えて get_weather 失敗時は locationLabel/summary が空文字のゼロ値オブジェクトに
              なり得るため、その場合も中身のないヘッダーとして弾く。*/}
          {weather == null || !weather.locationLabel || !weather.summary ? null : (
            <div className="bg-surface-secondary/40 flex items-center gap-3 rounded-md border p-3">
              <WeatherCodeIcon className="size-8 shrink-0" weatherCode={weather.weatherCode} />
              <div>
                <p className="text-sm font-medium">
                  {weather.locationLabel}・{weatherDateLabel} は{weather.summary}
                </p>
                <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>
                    {weather.tempMax}°C / {weather.tempMin}°C
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Umbrella aria-hidden="true" className="size-3.5" />
                    降水確率 {weather.precipitationProbability}%
                  </span>
                  {weather.humidity === undefined ? null : (
                    <span className="inline-flex items-center gap-1">
                      <Droplet aria-hidden="true" className="size-3.5" />
                      湿度 {weather.humidity}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
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
