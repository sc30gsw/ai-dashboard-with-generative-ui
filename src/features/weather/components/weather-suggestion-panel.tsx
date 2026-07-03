import { useChat } from "@ai-sdk/react";
import { AlertDialog, Button, Card, CloseIcon, Description, toast } from "@heroui/react";
import { Renderer } from "@openuidev/react-lang";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

import { genuiLibrary } from "~/features/chat/genui/library";
import { chatUiState, messageText } from "~/features/chat/utils/message-parts";
import { createReadToolMap } from "~/features/tasks/tools/adapters/tool-provider";
import { applyReorderSuggestion } from "~/features/weather/lib/apply-reorder";
import { extractSuggestionOrderedIds } from "~/features/weather/lib/extract-suggestion-ids";
import { createWeatherReadToolMap } from "~/features/weather/tools/adapters/tool-provider";

const readToolMap = { ...createReadToolMap(), ...createWeatherReadToolMap() };

const GEOLOCATION_TIMEOUT_MS = 3000;

type Coordinates = { lat: number; lon: number };

//? SSR/未対応ブラウザは無視して null を返し、呼び出し側は「座標なしで質問」にフォールバックする。
//? 許可拒否・タイムアウトも同様に null 扱い（システムプロンプトの Mode 3 が現在地の再質問等を担う）。
function getCurrentCoordinates() {
  return new Promise<Coordinates | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}

//? assistant-message.tsx の判定を踏襲した簡易版（"root =" 前方一致）。
//? weather → chat の逆方向 import を避けるためここではローカルに複製する。
function isOpenUiLangResponse(text: string) {
  return text.trimStart().startsWith("root =");
}

function suggestionPrompt(coordinates: Coordinates | null) {
  const locationHint =
    coordinates === null ? "現在地" : `現在地（緯度 ${coordinates.lat}, 経度 ${coordinates.lon}）`;

  return `今日の天気をふまえて、${locationHint}のタスクの順序を提案してください。`;
}

const weatherSuggestionTransport = new DefaultChatTransport({ api: "/api/chat" });

export function WeatherSuggestionPanel() {
  const [isApplying, setIsApplying] = useState(false);
  const { messages, sendMessage, status, error } = useChat({
    transport: weatherSuggestionTransport,
  });

  const { isStreaming, lastMessageId } = chatUiState(messages, status);
  const lastMessage = messages.at(-1);
  const suggestionText = lastMessage?.role === "assistant" ? messageText(lastMessage.parts) : "";
  const orderedIds = extractSuggestionOrderedIds(suggestionText);

  async function handleSuggest() {
    const coordinates = await getCurrentCoordinates();

    sendMessage({ text: suggestionPrompt(coordinates) });
  }

  async function handleConfirmApply() {
    if (orderedIds.length === 0) {
      return;
    }

    setIsApplying(true);

    await applyReorderSuggestion(orderedIds)
      .catch(() => toast.danger("順序の適用に失敗しました。"))
      .finally(() => setIsApplying(false));
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>天気を考慮した順序提案</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button isDisabled={isStreaming} onPress={() => void handleSuggest()} variant="primary">
            {isStreaming ? "提案を作成中..." : "順序提案"}
          </Button>

          <AlertDialog>
            <Button isDisabled={orderedIds.length === 0 || isApplying} variant="secondary">
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
                      提案されたタスクの順序をそのまま反映します。この操作は取り消せません。
                    </Description>
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
          <p className="text-sm text-red-600" role="alert">
            {error.message || "提案の取得に失敗しました。"}
          </p>
        ) : null}

        {suggestionText.length === 0 ? (
          <p className="text-muted text-sm">
            「順序提案」を押すと、今日の天気を考慮したタスクの順序を提案します。
          </p>
        ) : isOpenUiLangResponse(suggestionText) ? (
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
