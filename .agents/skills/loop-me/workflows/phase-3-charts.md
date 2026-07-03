# Workflow: Phase 3 — タスクチャート

**Loop**: `docs/weather-genui-spec.md` の実装（3/3）
**Trigger**: 手動テキストコマンド。**いつでも実行可**（Phase 1・2 に依存しない — 既存カラム `priority` / `completed` / `createdAt` のみで完結するため）
**Depends on**: なし
**Blocks**: なし
**Parallel-safe with**: Phase 1, Phase 2（ファイル競合なし）
**Effort 既定**: 実装 stage = `medium`、レビュー stage = セッション既定を継承（xhigh）

## Push right 方針

Stage 1（集計ロジック）を Red-Green で固めてから Stage 2（表示コンポーネント）を並列生成し、Stage 3（system prompt 追記）は独立に走らせる。Stage 4 のレビュー agent が a11y と spec 逸脱を検証し、コーディネーターが brief を一度だけ提示する。

## TDD スコープ

Red-Green 必須: **集計ロジック**（優先度別件数、優先度×完了/未完了、日別新規/完了数）。
対象外: recharts の表示コンポーネント自体、system prompt 文言。

## Stages

### Stage 1 — 依存追加 + 集計ロジック（起点。Stage 2 がこれに依存）

- `vp add recharts`（`@openuidev/react-ui` の transitive 依存を直接依存として明示追加）
- `src/features/dashboard/lib/task-chart-aggregation.ts` 新規 — 純粋関数 3 本:
  - `aggregateByPriority(tasks): { priority, count }[]`
  - `aggregateByPriorityAndCompletion(tasks): { priority, completed, incomplete }[]`
  - `aggregateByDay(tasks): { date, created, completed }[]`（`createdAt` で日別グルーピング。完了日時カラムが無い制約上、「作成日ベースの完了済み件数」として妥当な定義で実装する）
- TDD: 空配列・全件同一優先度・`completed` 混在・日付境界（同日複数件）をケースに含める

### Stage 2 — 3 チャートコンポーネント（Stage 1 完了後。ファイル別に並列）

すべて `src/features/dashboard/components/`、HeroUI Card + recharts、Eden `list_tasks` から取得したデータをクライアント集計（Stage 1 の関数を呼ぶ）:

- **2a**: `priority-pie-chart.tsx` — `PieChart`（high/medium/low 件数）
- **2b**: `completion-bar-chart.tsx` — 積み上げ `BarChart`（優先度 × 完了/未完了）
- **2c**: `daily-composed-chart.tsx` — recharts `ComposedChart`（Bar: 日別新規作成数、Line: 日別完了数）
- 3 点を `dashboard-page.tsx` に設置（Stage 2 完了後、軽微な配線のため同一 agent が続けて実施可）
- TDD: 対象外（表示層）。集計は Stage 1 で担保済み。

### Stage 3 — チャット内チャート指示（Stage 1・2 と独立、並列可、effort: low）

- `src/features/chat/lib/system-prompt.ts` に追記: 「優先度別グラフ／完了状況／推移」等の要求時、`list_tasks` の結果を元に openuiChatLibrary の `PieChart` / `BarChart` / `LineChart` / `AreaChart` 等を emit してよい旨の指示
- openuiChatLibrary に Composite 相当が無いため、チャット内 Composite が必要になった場合の custom component 追加は本 phase の**任意項目**とし、今回はスコープ外（脚注として prompt に「日別の複合表示が必要な場合は Bar と Line を別々の Card で並べる」と明記して代替する）
- TDD: 対象外

### Stage 4 — Spec 適合 + a11y レビュー（全 stage 完了後、単独、effort: xhigh）

チェック項目:

- ダッシュボード常設チャートが recharts 直接実装（LLM 非経由）になっているか（spec §9 の決定通り）
- 各チャートに説明的なラベル・凡例（スクリーンリーダー向け `aria-label` 等）があるか（frontend-a11y 観点）
- 「Composite Chart」要望が `daily-composed-chart.tsx` で充足されているか
- 集計ロジックのテストが境界値（空配列等）を含むか

## Checkpoint（brief）

Stage 4 完了後、一度だけ提示:

- 変更ファイル一覧
- `vp check` / `vp test` / `vp build` / `vp run doctor` 結果
- Stage 4 findings（あれば）
- チャート表示のスクリーンショット確認手順

`AskUserQuestion` で完了確認（本 phase は他 phase を起動しない独立完結）。
