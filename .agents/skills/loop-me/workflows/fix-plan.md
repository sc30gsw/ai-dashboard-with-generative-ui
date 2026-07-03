# Workflow: weather-genui レビュー修正（fix-plan 一括実装）

**Loop**: `docs/weather-genui-fix-plan.md`（`docs/weather-genui-review.md` の全 27 指摘）の実装
**Trigger**: 手動テキストコマンド。ベースコミット: `5d91e40`（Phase 1〜3 実装済み・チェックポイント済み）
**Depends on**: `5d91e40` が HEAD であること
**構造**: 前回（Phase 1〜3）と異なり、Wave 間のファイル依存が密なため**単一 workflow**として実行する（7 本の独立起動可能ファイルには分割しない）。
**Effort 既定**: 実装 stage = `medium`、レビュー stage = セッション既定を継承

## ファイル競合グラフ（分析結果 — この順序で衝突ゼロ）

- `apply-reorder.ts`: A（移動）→ B（メソッド変更）
- `weather-schema.ts`: B（query スキーマ追加）→ C（日付表現・範囲 refine）
- `weather-suggestion-panel.tsx`: A（移動）→ C（geolocation/timeZone 配線）
- `chat.tsx`（コンポーネント）: C（location/timeZone 送信）→ G（リトライボタン）
- `task-model.ts`: E（sortOrder wire 追加）→ F（ReorderTasksSchema 上限）
- `weather-service.ts`: F（レスポンス検証）→ G（WMO 表統合）
- `weather-widget.tsx`: D（DatePicker 配線・error prop）→ G（WMO 表統合）
- `extract-suggestion-ids.ts` / `dashboard-page.tsx`: A → G

→ **A → B → C → 並列{D, (E → F)} → G → 最終レビュー** で全衝突を回避できる。

## Push right 方針

Stage ごとに `vp check`/該当テストを通してから次へ。**checkpoint は 2 回のみ**（Wave C 完了後・Wave G+最終レビュー完了後）。それ以外の Wave 境界では止まらず連続実行する。

## TDD スコープ

Red-Green 必須: ロジック層のみ — `todayInTimeZone`、rate-limit のグローバル上限、weather-service のレスポンス検証、`ReorderTasksSchema` 境界、`extract-suggestion-ids` の括弧深度パース、live-query の複合ソート、ルートのメソッド変更後の再テスト。
対象外: DatePicker 配線、PieChart 見た目、リトライボタン UI、ファイル移動そのもの。

## ファイル移動方針

`git mv` で履歴を保持してから import パスを Edit で修正する（新規 Write + 旧ファイル削除はしない）。

---

## Stage 1 — Wave A: 構造移動（起点）

単一 agent（ファイル移動を含む一連の作業のため分割しない。medium effort）。

- `git mv src/features/weather/components/weather-suggestion-panel.tsx src/components/weather-suggestion-panel.tsx`
- `git mv src/features/weather/lib/apply-reorder.ts src/lib/apply-reorder.ts`（テストも同様に `git mv`）
- `git mv src/features/weather/lib/extract-suggestion-ids.ts src/lib/extract-suggestion-ids.ts`（テストも同様）
- import パス更新: `dashboard-page.tsx` / `task-list-page.tsx` の `WeatherSuggestionPanel` import 先を `~/components/weather-suggestion-panel` に変更
- 重複一本化: `readToolMap` 合成（`{ ...createReadToolMap(), ...createWeatherReadToolMap() }`）を `src/features/chat/genui/tool-provider-map.ts`（新規）の `createChatToolProviderMap()` として export。`assistant-message.tsx` とパネルの両方がこれを使うよう置き換え。`isOpenUiLangResponse` も chat 側 utils から export し、パネル側の簡易複製を削除
- 型重複解消: `WeatherToolProviderMap` を `weather/tools/` 内 1 箇所に統合。`src/types/tool.ts`（新規）に `ToolDefinition` 共通形を抽出し、`TaskTool`（tasks）と `WeatherTool`（weather）が extend
- パネル内修正（同一ファイル、直列で同時に）:
  - 「適用」ボタンを `isStreaming` 中 `isDisabled`
  - `handleConfirmApply` を `Result.tryPromise` で包み失敗を toast 表示（`apply-reorder.ts` 内の `refetchTasksCollection()` reject も捕捉）。※現在は暫定で `.catch()/.finally()` チェーンになっている（React Compiler の try 文非対応を回避するため）— この Wave で better-result 規約に沿った形に整理
  - `startsWith("root =")` を共用化した `isOpenUiLangResponse` に置き換え（自然に部分一致対応）
  - HeroUI DatePicker（今日〜+7 日）を追加し `suggestionPrompt` に選択日を埋め込み
  - AlertDialog の確認文言に `tasksCollection` で id→タイトル解決した順序付き列挙を表示

検証: `vp test`（移動したテスト含む全緑）、`grep -r "features/chat" src/features/weather src/features/tasks` が 0 件（feature 間 import 違反ゼロの確認）。

## Stage 2 — Wave B: ルート GET/PATCH 化（Stage 1 完了後）

単一 agent（`apply-reorder.ts` は Stage 1 移動後の `src/lib/` を編集）。

- `weather-routes.ts`: `POST /weather/get` → `GET /weather`。`weather-schema.ts` に `GetWeatherQuerySchema`（`z.coerce.number()` で緯度経度）を追加
- `task-routes.ts`: `POST /tasks/reorder` → `PATCH /tasks/reorder`
- `src/routes/api/$.ts`: server handlers に `PATCH: handle` を追加
- 連鎖修正: `get-weather.ts`（Eden `weather.get.post` → `weather.get({query})`）、`src/lib/apply-reorder.ts`（`tasks.reorder.post` → `tasks.reorder.patch`）、`reorder-tasks.ts` の run、`weather-routes.test.ts` / `task-routes.test.ts` のメソッド/URL

検証: 両ルートテスト（GET query 200/422、PATCH 200/422）＋ `vp test` 全緑。

## Stage 3 — Wave C: 日付・TZ 基盤 + Geolocation（Stage 2 完了後）

単一 agent（`chat.ts`・`weather-schema.ts`・パネルへの集中編集のため分割しない）。

- `src/lib/timezone.ts` 新設: `APP_DEFAULT_TIMEZONE = "Asia/Tokyo"`、`todayInTimeZone(timeZone)`（`Intl.DateTimeFormat("en-CA", {timeZone})`、不正 TZ は `Result.try` で捕捉し既定値へ）
- `ChatRequestSchema`（`src/routes/api/chat.ts`）に `location`（緯度経度 optional）・`timeZone`（string optional）追加
- system prompt へのリクエスト依存の現在日付注入（`system-prompt.ts` 本体は静的のまま、chat.ts が `## Current date` を都度連結）
- `weatherChatTools` をファクトリ化（`createWeatherChatTools(defaultCoords?)`）し、chat ルートで body.location を渡す
- `src/hooks/use-geolocation.ts` 新設（パネルの既存 geolocation ロジックを移管）。パネル（`src/components/weather-suggestion-panel.tsx`）とチャット本体コンポーネント（`chat.tsx`）の両方が `useChat` の body に `{location, timeZone}` を載せるよう変更。プロンプト文字列への座標埋め込みは削除
- `weather-schema.ts`: 日付判定を UTC ±1 日許容（today-1〜today+8）に緩和、コメントで理由明記。日付表現を `z.iso.date()` に統一

検証: chat ルートの body 検証テスト（location/timeZone 不正で 400）、`todayInTimeZone` の TZ 跨ぎテスト、weather-schema 境界テスト更新、`vp test` 全緑。

## Checkpoint 1（Stage 3 完了後）

brief 提示 → `AskUserQuestion` で Stage 4 以降への進行確認。

## Stage 4 — Wave D + (E→F) 並列（Checkpoint 1 承認後）

### 4a: Wave D（単独、Stage 3 と無衝突）

- `weather-widget.tsx`: `useState(selectedDate)` 削除。DatePicker `onChange` を `useTriggerAction()` で「{date} の天気でタスク順序を提案して」再送信に配線
- `weatherWidgetPropsSchema` に `error: z.string().nullable().optional()` 追加、error 時のコンパクトなエラーカード表示
- `system-prompt.ts` Mode 4 に「get_weather 失敗時は `WeatherWidget(error=...)` を emit してよい」旨追記

検証: `vp check`。

### 4b: Wave E → Wave F（同一 agent、`task-model.ts` 競合回避のため直列）

- E: `tasks-live-query.ts` / `use-filtered-tasks-query.ts` に sortOrder ASC nulls-last → createdAt の複合ソート実装。`TaskView`（wire 型）に sortOrder が無ければ追加
- F: `ReorderTasksSchema` → `.max(64)` / `.max(100)` 境界追加。`rate-limit.ts` にグローバル総量上限（60req/分、キー `"__global__"`）＋バケット数上限（1000、LRU 的に古いもの削除）。chat ルートで IP 別 → グローバルの順に判定。`weather-service.ts` のレスポンスに Zod 検証（緯度±90・経度±180）＋ `URLSearchParams` 化。`tool-approval-summary.ts` の `reorder_tasks` 分岐でチャット承認カード側も `tasksCollection` タイトル解決を表示

検証: E は reorder→collection refetch→一覧順序変更のユニットテスト。F は 101 件で 422、XFF 変更連投がグローバル上限で 429、レスポンス検証の型テスト。`vp test` 全緑。

## Stage 5 — Wave G（Stage 4 の 4a・4b 両方完了後）

単一 agent。

- `weather-service.ts` と `weather-widget.tsx` の WMO 表を `src/features/weather/lib/wmo-codes.ts` に統合
- `extract-suggestion-ids.ts`（`src/lib/`）の正規表現を括弧深度カウントに変更、後続ノード混入防止テスト追加
- `.claude/rules/web/ai-streaming.md` の `stepCountIs(3)` 記述を 5 に更新
- `weather-genui-spec.md` §8.1 に Renderer+Query 経由供給の追記
- `dashboard-page.tsx` の `PriorityDistributionChart` を recharts `PieChart`（`Pie`+`Cell`、3 色）に差し替え
- `chat.tsx` とパネルのエラー表示に `useChat` の再送/リトライボタン追加

検証: `vp check` / `vp test` / `vp build` / `vp run doctor`。

## Stage 6 — 最終レビュー（Stage 5 完了後、単独、effort: セッション既定継承）

`docs/weather-genui-review.md` の 27 項目 × 本 workflow の対応表を出力させ、未解消ゼロを確認。feature 間 import 違反の静的確認（`grep -r "features/chat" src/features/weather src/features/tasks` が 0 件、tasks⇄weather 循環なし）。`vp check`/`vp test`/`vp build` を自分で fresh 実行。

## Checkpoint 2（Stage 6 完了後）

brief（変更ファイル一覧、27 項目対応表、vp check/test/build 結果、findings）を提示 → `AskUserQuestion` でコミット可否を確認。
