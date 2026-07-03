# Workflow: Phase 2 — 適用 + チャット外展開

**Loop**: `docs/weather-genui-spec.md` の実装（2/3）
**Trigger**: 手動テキストコマンド。Phase 1 の checkpoint 承認後にのみ実行可。
**Depends on**: Phase 1 承認済み（`dueDate` / `location` / `sortOrder` カラム、`features/weather` 一式、`WeatherWidget` / `TaskSuggestion` が存在すること）
**Blocks**: なし
**Parallel-safe with**: Phase 3
**Effort 既定**: 実装 stage = `medium`、レビュー stage = セッション既定を継承（xhigh）

## Push right 方針

Stage 1〜3 の agent が各自テストを通した後、Stage 4 のレビュー agent が human-in-the-loop ゲートの実装を検証し、コーディネーターが brief を一度だけ提示する。

## TDD スコープ

Red-Green 必須: **reorder_tasks の再採番ロジック・Elysia ルート・確認ダイアログの確定ハンドラ**。
対象外: UI 表示（WeatherSuggestionPanel の見た目・レイアウト）、system prompt 文言。

## Stages

### Stage 1 — `reorder_tasks` ツール + API（起点。Stage 2・3 がこれに依存）

- **1a**: `src/features/tasks/schemas/task-schema.ts`（または既存 schemas ファイル）に `ReorderTasksSchema = z.object({ orderedIds: z.array(z.string()).min(1) })` 追加
- **1b**: `src/features/tasks/api/task-service.ts` にロジック追加 — `orderedIds` の順に `sortOrder = 1..N` で全体再採番。含まれない既存タスクの `sortOrder` は変更しない。`orderedIds` に DB 未存在の id が 1 件でもあれば **部分適用せず** 型付きエラー（TaggedError）を返す
  - TDD: 正常系（採番が 1..N になる／対象外タスクが不変）、未知 id を含む場合に全体が失敗し DB が無変更であること
- **1c**（1a・1b 完了後）: `src/features/tasks/api/task-routes.ts` に `PATCH /tasks/reorder` 追加、body に `ReorderTasksSchema`
  - TDD: `app.handle(new Request(...))` で正常系・不正 body の 400 系
- **1d**（1a〜1c 完了後）: `src/features/tasks/tools/defs/reorder-tasks.ts`（新規 def）＋ 3 アダプタ（ai-sdk / web-mcp / tool-provider には追加しない — mutation は toolProvider 対象外）＋ `TASK_TOOL_POLICY` に `reorder_tasks: { mutates: true, needsApproval: true }` 追加

### Stage 2 — チャット内適用の導線（Stage 1 完了後。Stage 3 とは独立＝並列可）

- **2a**: `src/features/chat/lib/system-prompt.ts` に `reorder_tasks` の使用指示追加（`TaskSuggestion` の「適用」ボタン押下 → LLM が `reorder_tasks` を呼ぶ導線。承認カードが出る旨は AI SDK が自動処理するため prompt には触れない）
- **2b**: `src/features/chat/genui/components/task-suggestion.tsx`（Phase 1 でダミー配線した「適用」ボタン）の `onAction` を実配線 — 押下でチャット入力欄に適用依頼メッセージを送信する形（`Mutation()` ノードは使わない。あくまでチャットメッセージ経由で LLM 呼び出しを誘発する）
- TDD: 2a は prompt のみで対象外。2b は UI 配線のためロジックテスト対象外（`onAction` が正しい文字列を送信することは軽量テストで確認してもよいが必須ではない）

### Stage 3 — `WeatherSuggestionPanel`（チャット外。Stage 1 完了後。Stage 2 と独立＝並列可）

- **3a**: `src/features/weather/components/weather-suggestion-panel.tsx` 新規
  - Geolocation: `navigator.geolocation.getCurrentPosition()` で座標取得（拒否/失敗時は座標なしで進行）
  - 「順序提案」ボタン → 既存 `/api/chat` に定型プロンプト（指定日＋座標を含む）を POST → 返ってきたストリームをその場の `<Renderer library={genuiLibrary} toolProvider={toolProviderMap}>` で描画
  - 適用ボタン → HeroUI 確認ダイアログ →確定ハンドラで Eden `PATCH /api/tasks/reorder` を直接呼ぶ（チャットを経由しない）
  - TDD: 確定ハンドラ（ダイアログ OK → Eden 呼び出しが正しい body で発火すること）はロジックとしてテスト対象
- **3b**（3a 完了後、ファイル別で並列）: `src/features/dashboard/components/dashboard-page.tsx` に `WeatherSuggestionPanel` を設置
- **3c**（3a 完了後、3b と並列）: タスク一覧ページ（`src/features/tasks/components/` の一覧コンポーネント）に同パネルを設置

### Stage 4 — Spec 適合レビュー（全 stage 完了後、単独、effort: xhigh）

チェック項目:

- Web MCP アダプタで `reorder_tasks` に elicitation ゲートがかかっているか（`toolProvider` には追加されていないこと＝mutation は toolProvider 対象外の原則を守っているか）
- チャット内適用が AI SDK の承認カード（`needsApproval: true`）を経由しているか（`Mutation()` ノードを使っていないか）
- チャット外適用が明示クリック（確認ダイアログ確定）をゲートにしているか
- UI ボタンとツールが同一ロジック（`task-service` の reorder 関数）を通っているか（重複実装がないか）
- 未知 id 混入時に部分適用されないテストが存在するか
- 二重検証（ツール境界 Zod ＋ Elysia ルート body 検証）が揃っているか

## Checkpoint（brief）

Stage 4 完了後、一度だけ提示:

- 変更ファイル一覧
- `vp check` / `vp test` / `vp build` 結果
- Stage 4 findings（あれば）
- 動作確認手順（例: チャットで提案→適用、`/dashboard` から提案→適用）

`AskUserQuestion` で「Phase 3 の状況を踏まえて完了とするか」を確認（Phase 3 は独立のため Phase 2 承認は次 phase を起動しない — 完了通知のみ）。
