import { createReadToolMap } from "~/features/tasks/tools/adapters/tool-provider";
import { createWeatherReadToolMap } from "~/features/weather/tools/adapters/tool-provider";

//* OpenUI <Renderer toolProvider={...}> 用の read-only 関数マップ。tasks/weather の
//* read ツールを合成する唯一の場所（assistant-message.tsx とパネルの両方がここを参照する）。
export function createChatToolProviderMap() {
  return { ...createReadToolMap(), ...createWeatherReadToolMap() };
}
