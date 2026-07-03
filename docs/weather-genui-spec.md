# 天気連動 Generative UI 拡張仕様書

> 対象ブランチ: `feature/add-generative-ui` / 作成日: 2026-07-03
> 本書は /grill-me インタビューで確定した決定事項に基づく。§13 に未確認の仮決定を明示する。

## 1. 背景・目的

本プロジェクト（Generative UI × Web MCP の実験）に以下の 3 機能を追加する。

1. **天気ウィジェット** — 指定日・指定地点の天気を表示する Generative UI コンポーネント
2. **天気連動タスク順序提案** — 指定日の天気に応じて「その日にやるべきタスクの順序」を LLM が提案し、承認のうえ DB に適用できる UI
3. **タスクチャート** — タスクを優先度・完了状況・日別推移で可視化（PieChart / BarChart / Composite Chart）

既存アーキテクチャ（TanStack Start / Elysia + Eden / Drizzle + Turso / AI SDK + OpenUI / ツールレジストリ defs+adapters）は**維持**する。破壊的変更はしない。

## 2. スコープ / 非スコープ

**スコープ**

- `tasks` テーブルへの additive なカラム追加（§4）
- `src/features/weather/` 新設と core ドメイン化（§5）
- `get_weather` / `reorder_tasks` ツール追加（§6）
- Elysia ルート追加: `GET /api/weather` / `PATCH /api/tasks/reorder`（§7)
- チャット内提案 UI ＋ `/dashboard`・タスク一覧への共通提案パネル（§8）
- ダッシュボード常設チャート 3 種（§9）

**非スコープ**

- Bun 移行・バリデータ変更（Zod 単一を維持）
- タスクの所要時間（estimatedMinutes）等、順序最適化の高度化
- 天気のキャッシュテーブル（Open-Meteo を都度 fetch。必要になったら別途検討）

## 3. 決定事項サマリ

| 論点             | 決定                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| DB               | additive カラム追加のみ許容（既存カラム変更・削除は禁止）                                                  |
| 天気 API         | Open-Meteo（無料・API キー不要）＋同社 Geocoding API                                                       |
| 地点             | ツール引数で都市名指定可。未指定時はブラウザ Geolocation の座標を既定値に                                  |
| 指定日           | チャット自然言語＋ウィジェット内 DatePicker の両方（予報は 7 日先まで）                                    |
| 提案ロジック     | LLM 推論（`get_weather` + `list_tasks` の 2 ツール）。LLM/ツール失敗時のフォールバック必須                 |
| 提案の適用       | `reorder_tasks` ツール新設（承認必須）。画面からは Eden 直＋確認ダイアログ                                 |
| 設置面           | チャット / `/dashboard` / タスク一覧（共通パネル）                                                         |
| チャート         | チャット内 = LLM が openuiChatLibrary のチャートを emit。ダッシュボード常設 = recharts + HeroUI の静的実装 |
| 天気ツール公開面 | 全サーフェス（AI SDK / OpenUI toolProvider / Web MCP）                                                     |
| 配置             | `src/features/weather/` 新設。core ドメイン例外に weather を追加（ルール改定込み）                         |

## 4. DB スキーマ変更（Drizzle / additive のみ）

`src/db/schema.ts` の `tasks` に追加:

```ts
export const TASK_LOCATIONS = ["indoor", "outdoor"] as const satisfies readonly string[];

// tasks への追加カラム（すべて nullable / default — 既存行を壊さない）
dueDate: integer("due_date", { mode: "timestamp" }),            // 期限。「指定日のタスク」抽出軸
location: text("location", { enum: TASK_LOCATIONS }),           // 屋内/屋外。天気連動提案の核
sortOrder: integer("sort_order"),                               // 提案適用後の表示順。null = 未採番
```

- マイグレーションは `vp exec drizzle-kit generate` → `migrate`。
- `drizzle-zod` の派生スキーマ（insert/select）は自動で追随。**既存ツール `add_task` / `update_task` / `bulk_add_tasks` / `bulk_update_tasks` の inputSchema に `dueDate` / `location` を optional 追加**する（LLM がタイトルから屋内外を推定して埋める運用を可能にする）。`sortOrder` は既存ツールに**露出させない**（順序変更は `reorder_tasks` 専用。§6）。
- **一覧の並び順**: `sortOrder ASC`（null は末尾）→ `createdAt ASC` フォールバック。`list_tasks` と既存タスク一覧 UI の双方に適用。

## 5. `src/features/weather/` 新設（core ドメイン化）

```
src/features/weather/
├── api/
│   ├── weather-routes.ts     # Elysia controller: GET /api/weather（Zod query 検証）
│   └── weather-service.ts    # Open-Meteo fetch（Geocoding + Forecast）。better-result で Result 返却
├── schemas/
│   └── weather-schema.ts     # GetWeatherInput / WeatherReport（Zod、z.infer で型導出）
├── tools/
│   ├── defs/                 # get_weather の meta def（name/description/inputSchema/outputSchema）
│   └── adapters/             # ai-sdk.ts（in-process で weather-service 呼び）/ web-mcp.ts / tool-provider.ts（Eden 経由）
└── components/
    └── weather-widget.tsx    # HeroUI ベースの表示部（§8.1）
```

- **ルール改定**: `.claude/rules/typescript/project-structure.md` の core ドメイン例外に `weather` を追記する（`tasks` と同格。`chat` / `dashboard` / `tasks` から `~/features/weather` の import を許可）。改定は Phase 1 に含める。
- weather-service は Elysia `Context` に依存しない plain function。外部 fetch は `Result.tryPromise` で包み、controller で Result → plain HTTP body に変換（Result をワイヤに漏らさない）。

### Open-Meteo 呼び出し（キー不要）

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=ja`
- Forecast: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`
- `weather_code`（WMO コード）→ 表示ラベル/アイコンへの変換テーブルを weather-service に持つ。

## 6. ツール設計

### 6.1 `get_weather`（weather feature / read-only）

- **inputSchema (Zod)**: `{ city?: string, latitude?: number, longitude?: number, date: string /* YYYY-MM-DD, 今日〜7日先 */ }`
  - `city` 指定時は Geocoding で座標化。`city` も座標も無い場合はリクエスト由来の既定座標（§8.4 Geolocation）。それも無ければ型付きエラー。
- **outputSchema (Zod)**: `{ locationLabel, date, weatherCode, summary, tempMax, tempMin, precipitationProbability, daily: DailySummary[] /* 7日分の概況 */ }`
- **公開面**: 3 アダプタすべて。read-only のため `mutates: false`・`needsApproval: false`・Web MCP の elicitation ゲート対象外。OpenUI `toolProvider` にも追加し、`Query()` による天気ウィジェット自動描画を可能にする。

### 6.2 `reorder_tasks`（tasks feature / mutating）

- **inputSchema (Zod)**: `{ orderedIds: z.array(z.string()).min(1) }`
- **挙動**: `orderedIds` の順に `sortOrder = 1..N` を全体再採番。`orderedIds` に含まれないタスクは `sortOrder` を変更しない（null のまま末尾）。存在しない id が混ざっていたら型付きエラー（部分適用しない）。
- **ポリシー**: `TASK_TOOL_POLICY` に `reorder_tasks: { mutates: true, needsApproval: true }` を追加。Web MCP アダプタでは既存の全 mutation elicitation ゲートが自動適用される。

### 6.3 `stopWhen` の引き上げ

提案フローは `get_weather` → `list_tasks` → （適用時 `reorder_tasks`）→ 最終応答で最大 4 ステップ。`src/routes/api/chat.ts` の `stopWhen: stepCountIs(3)` を **`stepCountIs(5)`** に引き上げる（暴走防止の趣旨は維持）。

## 7. Elysia API 変更

| ルート                     | 用途                                                           | 検証                                  |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| `GET /api/weather`         | Web MCP / toolProvider アダプタと画面用の天気取得（Eden 経由） | query を Zod（Standard Schema）で検証 |
| `PATCH /api/tasks/reorder` | `reorder_tasks` の実体。UI ボタンからも Eden で直接呼ぶ        | body: `ReorderTasksSchema`            |

- controller は Result を plain object（`{ ok: true, ... } | { ok: false, message }`）に変換して返す（既存パターン踏襲）。
- **二重検証の原則維持**: ツール boundary（Zod parse in execute）＋ Elysia ルート body/query の両方で検証。

## 8. UI 設計

### 8.1 天気ウィジェット（`WeatherWidget`）

- `defineComponent`（props は Zod、全 field に `.describe()`）。HeroUI Card ベースの **self-contained** コンポーネント（OpenUI の `Card([...])` に包まない。system prompt で root emit を指示 — styling 規約準拠）。
- 表示内容: 指定日の天気ラベル/アイコン・最高/最低気温・降水確率＋ 7 日分の概況ストリップ。
- **DatePicker 内蔵**（HeroUI）: 日付変更 → `onAction` 経由で「{date} の天気でタスク順序を提案して」を再送信するラウンドトリップ。
- チャット内は LLM が `Query()`（`get_weather`）付きで emit → toolProvider が自動解決。チャット外（§8.3）は同じ React 表示部を `GET /api/weather`（Eden）で直接データ供給して再利用する。
  - **実装確認済み補記**: 実装では §8.3 のチャット外パネル（`WeatherSuggestionPanel`）も直接 Eden fetch の別データパスは持たず、チャット内と同じ `<Renderer toolProvider={...}>` + `Query()` 経路で `WeatherWidget` を表示している。レビューの結果、この構成で要件を満たすと判断し、直接データ供給パスの追加は不要（ギャップではなく設計判断）。

### 8.2 タスク順序提案 UI（`TaskSuggestion`）

- `defineComponent`。HeroUI self-contained。
- 表示: 提案順のタスクリスト（順位・タイトル・優先度 Chip・屋内/屋外・**理由**（例: 「午後から降水確率 70% のため屋外タスクを先に」））＋「この順序を適用」ボタン。
- **適用の二面構成**:
  - チャット内: 適用ボタン → `onAction` で LLM に適用を依頼 → `reorder_tasks` ツール呼び出し → **AI SDK 承認カード**が human-in-the-loop ゲート。
  - チャット外パネル（§8.3）: 適用ボタン → HeroUI 確認ダイアログ →（人間のクリックが明示ゲート）→ Eden `PATCH /api/tasks/reorder` 直接呼び出し。UI ボタンとツールが同一ロジック（Elysia ルート）を通る原則を維持。

### 8.3 チャット外共通パネル（`WeatherSuggestionPanel`）

- 配置: `/dashboard` とタスク一覧ページの両方。共通コンポーネントは `src/features/weather/components/` に集約（weather が core 化されるため両ページから import 可）。
- 駆動: 「順序提案」ボタン → 既存 `/api/chat` に定型プロンプト（指定日・座標込み）を POST → ストリーム応答をその場の `<Renderer library={genuiLibrary} toolProvider={...}>` で描画。**専用エンドポイントは追加しない**（ロジック共有・実装最小）。

### 8.4 Geolocation（既定地点）

- クライアントで `navigator.geolocation.getCurrentPosition()`（許可プロンプトあり）→ 取得座標を `useChat` の `body`（例: `{ location: { latitude, longitude } }`）でサーバーへ。
- chat ルートは body の座標を Zod で検証し、`get_weather` の既定座標としてツールコンテキストに渡す。
- 拒否/未取得時: 既定座標なし → LLM は都市名をユーザーに尋ねる（既存 clarify フローに乗せる）。

### 8.5 system prompt 更新

- 現在日付の埋め込み（「明日」「土曜」の解決に必須）。
- 提案フロー指示: `get_weather` → `list_tasks` → 天気 × location × priority × dueDate で順序推論 → root に `TaskSuggestion` を emit。
- チャート指示: 「優先度別の円グラフ」等の依頼には `list_tasks` の結果から openuiChatLibrary の `PieChart` / `BarChart` / `LineChart` 等を emit してよい。
- **縮退指示**: `get_weather` が失敗を返したら、天気抜きで priority / dueDate のみから順序提案し、天気が取得できなかった旨を明示する。

## 9. ダッシュボード常設チャート（静的実装）

- 方式: **recharts 直接 + HeroUI Card**（LLM 非経由・決定的・ゼロトークン）。`vp add recharts`（現状 `@openuidev/react-ui` の transitive 依存のため、直接依存として明示追加）。
- データ: Eden `list_tasks` で全件取得 → クライアント集計（規模が小さい前提。集計 API は作らない）。
- 構成（`src/features/dashboard/components/`）:

| チャート     | 種類                 | 軸                                                                  |
| ------------ | -------------------- | ------------------------------------------------------------------- |
| 優先度別内訳 | PieChart             | high / medium / low の件数                                          |
| 完了状況     | BarChart（積み上げ） | 優先度 × 完了/未完了                                                |
| 日別推移     | ComposedChart        | 日別の新規作成数（Bar）＋完了数（Line） — 要望の「Composite Chart」 |

- チャット内のオンデマンドチャートは openuiChatLibrary 標準（PieChart / BarChart / LineChart / AreaChart 等）を LLM が emit（実装は system prompt 更新のみ）。openuiChatLibrary に Composite は無いため、チャット内で必要になった場合のみ recharts `ComposedChart` を包む custom `defineComponent` を追加検討（Phase 3 の任意項目）。

## 10. エラーハンドリング / フォールバック

| 障害                         | 挙動                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open-Meteo / Geocoding 失敗  | weather-service が `Result` の型付きエラー（TaggedError: 原因・retryability）→ ツールはエラーテキストを返す → LLM は §8.5 の縮退提案（天気抜き） |
| LLM ストリーム自体の失敗     | `useChat` の `error` を UI に表示＋リトライボタン（ストリームは wrap しない — better-result 規約どおり）                                         |
| チャット外パネルの提案失敗   | パネル内にエラー表示＋再試行。天気ウィジェット単体は `GET /api/weather` の `ok:false` を受けてエラー状態カードを表示                             |
| `reorder_tasks` の id 不整合 | 部分適用せず型付きエラー。UI はメッセージ表示のみ（DB 無変更）                                                                                   |

## 11. セキュリティ / バリデーション

- API キー不要（Open-Meteo）のため新規シークレットなし。env 追加なし。
- LLM 発の引数は信頼しない: ツール boundary の Zod parse ＋ Elysia ルートの二重検証（既存原則）。座標・日付（今日〜7 日先）も Zod で範囲検証。
- mutation は全ゲート維持: チャット = `needsApproval` 承認カード / Web MCP = 全 mutation elicitation / 画面 = 確認ダイアログ。
- `dangerouslySetInnerHTML` 不使用。天気ラベル等もすべて React 既定エスケープ。

## 12. フェーズ計画

### Phase 1 — 基盤＋チャット内提案（コア価値）

1. スキーマ追加（dueDate / location / sortOrder）＋マイグレーション → 検証: `vp exec drizzle-kit generate && migrate`
2. `features/weather` 新設（service / Elysia ルート / defs / 3 アダプタ）＋ project-structure ルール改定 → 検証: `app.handle(new Request(...))` の controller テスト＋service の Result 成功/失敗テスト
3. 既存タスクツールへの dueDate / location 追加、`list_tasks` 並び順変更 → 検証: 既存テスト更新＋`vp test`
4. system prompt 更新（現在日付・提案フロー・縮退指示）＋ `stopWhen(5)`、`WeatherWidget` / `TaskSuggestion` defineComponent → 検証: チャットで「明日の天気でタスク順序を提案して」が E2E で動く

### Phase 2 — 適用＋チャット外展開

5. `reorder_tasks` ツール＋`PATCH /api/tasks/reorder`＋ポリシー追加 → 検証: 再採番ロジックのユニットテスト（不明 id で全体失敗すること含む）
6. チャット内適用（承認カード）＋一覧の sortOrder 反映 → 検証: 承認 → 一覧順序が変わる
7. `WeatherSuggestionPanel`（/dashboard・タスク一覧）＋Geolocation 連携＋Eden 直適用（確認ダイアログ） → 検証: チャット外から提案 → 適用まで通る

### Phase 3 — チャート

8. `vp add recharts`＋ダッシュボード 3 チャート（Pie / 積み上げ Bar / Composed） → 検証: `vp run doctor`・表示確認
9. system prompt にチャート emit 指示追加（チャット内オンデマンド） → 検証: 「優先度別の円グラフ見せて」で PieChart が出る
10. （任意）チャット用 Composite custom component

各フェーズ完了時に `vp check` / `vp test` / `vp build` を通すこと。

## 13. 仮決定（ユーザー未確認 — 実装前に要確認）

インタビュー中に無応答だったため推奨案で仮採用した項目:

1. **追加カラムの構成**（dueDate / location の 2 つ。estimatedMinutes は見送り）— §4
2. **最終確認そのもの**（本仕様書全体の承認）— 特に §8 の UI 詳細と §12 のフェーズ切りは異議があれば組み替え可能

## 14. 参照

- `.claude/rules/web/generative-ui.md` / `ai-streaming.md` / `web-mcp.md` / `backend-elysia-drizzle.md` / `elysia-best-practice.md` / `styling.md`
- `.claude/rules/typescript/zod-validation.md` / `better-result.md` / `project-structure.md`（§5 の改定対象）
- Open-Meteo: https://open-meteo.com/en/docs / Geocoding: https://open-meteo.com/en/docs/geocoding-api
