# Workflow: Phase 1 — 基盤 + チャット内提案

**Loop**: `docs/weather-genui-spec.md` の実装（1/3）
**Trigger**: 手動テキストコマンド（例:「phase 1 実行して」）。コーディネーターが本ファイルを読み、`Workflow` ツールに script を組んで実行する。
**Depends on**: なし（起点）
**Blocks**: Phase 2（本 phase の checkpoint 承認が前提）
**Parallel-safe with**: Phase 3（ファイル競合なし、同時実行可）
**Effort 既定**: 実装 stage = `medium`、レビュー stage = セッション既定を継承（xhigh）

## Push right 方針

各 stage の agent は自スコープの `vp check` 相当・該当テストを通してから次 stage に渡す。全 stage 完了後、Stage 5 の専用レビュー agent が spec 適合を検証し、コーディネーターが brief を一度だけ提示する。

## TDD スコープ

Red-Green 必須: **ロジック層のみ**（weather-service の Result 成功/失敗、Elysia ルートの入出力、既存タスクツールの inputSchema 拡張、list-tasks の並び順）。
対象外: UI 表示コンポーネント（WeatherWidget / TaskSuggestion の見た目）、system prompt の文言。

## Stages（pipeline、依存順で連結。カッコ内は並列可否）

### Stage 0 — ルール改定（Stage 1 と並列可、effort: low）

- ファイル: `.claude/rules/typescript/project-structure.md`
- 内容: core ドメイン例外に `weather` を追記（`tasks` と同格。`chat` / `dashboard` / `tasks` からの `~/features/weather` import を許可する一文を追加）
- TDD: 対象外（ドキュメント変更）

### Stage 1 — DB スキーマ（起点。Stage 2・3 がこれに依存）

- ファイル: `src/db/schema.ts`
- 内容:
  ```ts
  export const TASK_LOCATIONS = ["indoor", "outdoor"] as const satisfies readonly string[];
  // tasks に追加（すべて nullable、既存行を壊さない）
  dueDate: integer("due_date", { mode: "timestamp" }),
  location: text("location", { enum: TASK_LOCATIONS }),
  sortOrder: integer("sort_order"),
  ```
- 実行コマンド: `vp exec drizzle-kit generate` → `vp exec drizzle-kit migrate`
- 検証: `vp check`（型が通る）、既存 `src/features/tasks/tools/task-tools.test.ts` が壊れないこと
- TDD: マイグレーション自体は対象外。drizzle-zod 派生型を使う既存テストの回帰確認が Red-Green の実体。

### Stage 2 — `features/weather` scaffold（Stage 1 完了後に着手。内部はファイル単位で最大並列）

新規ドメインのため既存ファイルと競合しない。以下を並列 fan-out:

- **2a**: `src/features/weather/schemas/weather-schema.ts`（Zod: `GetWeatherInput { city?, latitude?, longitude?, date }` / `WeatherReport { locationLabel, date, weatherCode, summary, tempMax, tempMin, precipitationProbability, daily[] }`）＋ `src/features/weather/api/weather-service.ts`（Open-Meteo Geocoding + Forecast fetch、`Result.tryPromise` で包む、TaggedError で失敗理由付き）
  - Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=ja`
  - Forecast: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`
  - TDD: fetch を mock し、成功時の Result.ok・Geocoding失敗時/Forecast失敗時の Result.err（TaggedError）をテスト
- **2b**（2a の型に依存、内容実装は 2a 完了を待つ）: `src/features/weather/api/weather-routes.ts`（Elysia controller、`GET /api/weather`、query を Zod 検証、Result → plain body 変換）
  - TDD: `app.handle(new Request("http://localhost/api/weather?..."))` で正常系 200・不正 query の 400 系
- **2c**: `src/features/weather/tools/defs/get-weather.ts`（meta def: name/description/inputSchema/outputSchema、`mutates: false`）
- **2d**（2c 完了後）: `src/features/weather/tools/adapters/{ai-sdk,web-mcp,tool-provider}.ts`
  - ai-sdk: in-process で weather-service 呼び出し、`needsApproval: false`
  - web-mcp: Eden 経由、read-only のため elicitation ゲート対象外
  - tool-provider: `Query()` 自動解決用の read-only 関数

### Stage 3 — 既存タスクツール拡張（Stage 1 完了必須。Stage 2 とは独立＝並列可。内部はファイル単位で並列）

- 対象: `src/features/tasks/tools/add-task.ts` / `update-task.ts` / `bulk-add-tasks.ts` / `bulk-update-tasks.ts` の inputSchema に `dueDate?: z.date()` `location?: z.enum(TASK_LOCATIONS)` を optional 追加
- 対象: `src/features/tasks/tools/list-tasks.ts` の並び順を `sortOrder ASC NULLS LAST, createdAt ASC` に変更
- `sortOrder` はこれらのツールに**露出させない**（`reorder_tasks` 専用、Phase 2 で新設）
- TDD: 各ツールの既存テストに dueDate/location を含むケースを追加。list-tasks の並び順テストを追加（sortOrder が null 混在のケース含む）

### Stage 4 — Generative UI（Stage 2・Stage 3 完了後。ファイル別に並列）

- **4a**: `src/features/chat/lib/system-prompt.ts` 更新 — 現在日付の埋め込み、提案フロー指示（`get_weather` → `list_tasks` → 天気×location×priority×dueDate で順序推論 → root に `TaskSuggestion` emit）、チャート指示（`list_tasks` 結果から openuiChatLibrary の PieChart/BarChart/LineChart 等を emit してよい旨）、縮退指示（`get_weather` 失敗時は天気抜きで priority/dueDate のみから提案し、天気取得失敗を明示）
- **4b**: `src/features/weather/components/weather-widget.tsx` — `defineComponent`、props は Zod（全 field `.describe()`）、HeroUI Card self-contained（OpenUI `Card([...])` に包まない）、HeroUI DatePicker 内蔵（日付変更 → `onAction` で「{date} の天気でタスク順序を提案して」を再送信）
- **4c**: `src/features/chat/genui/components/task-suggestion.tsx` — `defineComponent`、HeroUI Card self-contained、提案順タスクリスト（順位・タイトル・優先度 Chip・屋内/屋外・理由テキスト）＋「この順序を適用」ボタン（`onAction` で LLM に適用依頼 → `reorder_tasks` 呼び出しは Phase 2 で実体化。Phase 1 時点ではボタンの `onAction` 配線とダミー無効化まで）
- **4d**: `src/routes/api/chat.ts` の `stopWhen: stepCountIs(3)` → `stepCountIs(5)`
- **4e**: `src/features/chat/genui/library.ts` に `weather-widget` / `task-suggestion` を登録し `genuiLibrary` に反映
- TDD: 対象外（表示層・prompt 文言）。登録漏れは Stage 5 で検証。

### Stage 5 — Spec 適合レビュー（全 stage 完了後、単独、effort: xhigh）

`docs/weather-genui-spec.md` §5〜§8 と実装差分を照合。チェック項目:

- `get_weather` が `mutates:false` / `needsApproval:false` で AI SDK・Web MCP・toolProvider の 3 アダプタ全てに存在するか
- `TASK_TOOL_POLICY` の既存エントリを壊していないか
- `.claude/rules/typescript/project-structure.md` の core 例外に `weather` が入っているか
- `WeatherWidget` / `TaskSuggestion` が `Card([...])` に包まれず root emit 想定になっているか（styling.md 準拠）
- `dangerouslySetInnerHTML` が使われていないか
- ツール境界（execute 内 Zod parse）＋ Elysia ルート（body/query 検証）の二重検証が両方にあるか
- `sortOrder` が既存ツールの inputSchema に漏れ出ていないか

出力: findings（severity 付き、なければ空）。

## Checkpoint（brief）

Stage 5 完了後、コーディネーターが一度だけ提示:

- 変更ファイル一覧（新規/更新）
- `vp check` / `vp test` / `vp build` の結果（pass/fail、fail 時は該当箇所）
- Stage 5 findings（あれば）
- 残課題（あれば）

`AskUserQuestion` で「Phase 2 に進むか」を問う。承認 → `workflows/phase-2-apply.md` を次ターンで手動トリガー。却下/要修正 → 指摘箇所を修正し同一 `runId` から `resumeFromRunId` で再実行。
