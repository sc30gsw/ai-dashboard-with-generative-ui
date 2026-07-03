import { useChat } from "@ai-sdk/react";
import {
  AlertDialog,
  Button,
  Calendar,
  Card,
  CloseIcon,
  DateField,
  DatePicker,
  Description,
  toast,
} from "@heroui/react";
import { Renderer } from "@openuidev/react-lang";
import { DefaultChatTransport } from "ai";
import { Result } from "better-result";
import { useState } from "react";

import { genuiLibrary } from "~/features/chat/genui/library";
import { createChatToolProviderMap } from "~/features/chat/genui/tool-provider-map";
import { resolveIsOpenUiLang } from "~/features/chat/lib/clarify-response";
import { extractSuggestionOrderedIds } from "~/features/chat/lib/extract-suggestion-ids";
import { chatUiState, messageText } from "~/features/chat/utils/message-parts";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { applyReorderSuggestion, ReorderApplyError } from "~/features/tasks/utils/apply-reorder";
import { APP_DEFAULT_TIMEZONE, todayRangeInTimeZone } from "~/lib/timezone";
import { getCurrentCoordinates } from "~/utils/geolocation";

const readToolMap = createChatToolProviderMap();

//? 座標はプロンプト文字列ではなく useChat の body（location）でサーバーへ渡す。
//? サーバー側が get_weather のデフォルト座標として使う（§6.1 のフォールバックチェーン）。
function suggestionPrompt(selectedDate: string) {
  return `${selectedDate} の天気をふまえて、現在地のタスクの順序を提案してください。`;
}

const weatherSuggestionTransport = new DefaultChatTransport({ api: "/api/chat" });

export function WeatherSuggestionPanel() {
  //? マウント時の日付を一度だけ取得する（render のたびに算出すると React Compiler の
  //? purity ルールに反するため、lazy initializer で一度だけ評価する）。
  const [{ end: maxDate, start: today }] = useState(() =>
    todayRangeInTimeZone(APP_DEFAULT_TIMEZONE),
  );

  const [isApplying, setIsApplying] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: weatherSuggestionTransport,
  });

  const { isStreaming, lastMessageId } = chatUiState(messages, status);
  const lastMessage = messages.at(-1);
  const suggestionText = lastMessage?.role === "assistant" ? messageText(lastMessage.parts) : "";
  const orderedIds = extractSuggestionOrderedIds(suggestionText);

  async function handleSuggest() {
    const coordinates = await getCurrentCoordinates();

    sendMessage(
      { text: suggestionPrompt(selectedDate) },
      {
        body: {
          location: coordinates ?? undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    );
  }

  async function handleConfirmApply() {
    if (orderedIds.length === 0) {
      return;
    }

    setIsApplying(true);

    const result = await Result.tryPromise({
      catch: (cause) => new ReorderApplyError({ cause, message: "順序の適用に失敗しました。" }),
      try: () => applyReorderSuggestion(orderedIds),
    });

    if (Result.isError(result)) {
      toast.danger(result.error.message);
    }

    setIsApplying(false);
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>天気を考慮した順序提案</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            className="w-40"
            onChange={(value) => {
              if (value) {
                setSelectedDate(value.toString());
              }
            }}
          >
            <DateField.Group>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateField.Suffix>
                <DatePicker.Trigger aria-label="提案する日付を選択">
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover offset={8} placement="bottom end">
              <Calendar
                isDateUnavailable={(date) => {
                  const iso = date.toString();

                  return iso < today || iso > maxDate;
                }}
              >
                <Calendar.Header>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.Heading />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>
                    {(gridDate) => <Calendar.Cell date={gridDate} />}
                  </Calendar.GridBody>
                </Calendar.Grid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>

          <Button isDisabled={isStreaming} onPress={() => void handleSuggest()} variant="primary">
            {isStreaming ? "提案を作成中..." : `${selectedDate} の順序提案`}
          </Button>

          <AlertDialog>
            <Button
              isDisabled={orderedIds.length === 0 || isApplying || isStreaming}
              variant="secondary"
            >
              適用
            </Button>
            <AlertDialog.Backdrop>
              <AlertDialog.Container>
                <AlertDialog.Dialog className="sm:max-w-[400px]">
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="accent" />
                    <AlertDialog.Heading>この順序を適用しますか？</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <Description>
                      次の順序でタスクを並び替えます。この操作は取り消せません。
                    </Description>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                      {orderedIds.map((id) => (
                        <li key={id}>{tasksCollection.get(id)?.title ?? id}</li>
                      ))}
                    </ol>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button slot="close" variant="tertiary">
                      <span className="inline-flex items-center gap-1.5">
                        <CloseIcon />
                        キャンセル
                      </span>
                    </Button>
                    <Button
                      isDisabled={isApplying}
                      onPress={() => void handleConfirmApply()}
                      slot="close"
                      variant="primary"
                    >
                      適用する
                    </Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog>
        </div>

        {error ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-600" role="alert">
              {error.message || "提案の取得に失敗しました。"}
            </p>
            <Button onPress={() => regenerate()} size="sm" variant="secondary">
              再試行
            </Button>
          </div>
        ) : null}

        {suggestionText.length === 0 ? (
          <p className="text-muted text-sm">
            日付を選んで「順序提案」を押すと、その日の天気を考慮したタスクの順序を提案します。
          </p>
        ) : resolveIsOpenUiLang(suggestionText, { isLastMessage: true, isStreaming }) ? (
          <Renderer
            isStreaming={isStreaming}
            key={lastMessageId}
            library={genuiLibrary}
            response={suggestionText}
            toolProvider={readToolMap}
          />
        ) : (
          <p className="text-sm leading-6 text-zinc-800">{suggestionText}</p>
        )}
      </Card.Content>
    </Card>
  );
}
