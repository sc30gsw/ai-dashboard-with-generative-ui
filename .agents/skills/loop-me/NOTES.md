# NOTES — ai-dashboard-with-generative-ui

## この repo での「loop」の意味

本来 loop-me は人生の反復ループ向けだが、この repo では **「spec を multi-agent workflow で実装する」という開発上の反復パターン**に語彙を転用する（ユーザー確認済み）。

- **loop** = 1 つの spec ドキュメント（例: `docs/weather-genui-spec.md`）を実装まで持っていく一連の作業
- **workflow** = その loop の実行仕様。`Workflow` ツール（`.claude/skills` 外、ネイティブツール）に渡せる script のもと
- **trigger** = ここでは主にユーザーの明示コマンド（イベント/スケジュールではない）
- **checkpoint** = phase 完了ごとの人間レビュー（spec の Phase 1/2/3 境界と一致させる）
- **push right** = 各 phase 内で fan-out 実装 → `vp check` / `vp test` / `vp build` を agent 自身が通してから human に見せる
- **brief** = 生 diff ではなく「変更ファイル一覧＋テスト結果＋残課題」の短い要約

## 道具（tools they use）

- パッケージ/実行: **Vite+ (`vp`)**。`pnpm`/`npm` 直接禁止。`vp check` `vp test` `vp build` `vp exec drizzle-kit ...`
- API 層: **Elysia**（TanStack Start に `app.fetch` でマウント、Node 実行）、クライアントは **Eden Treaty**
- DB: **Drizzle ORM + Turso(libsql)**、Zod ブリッジは `drizzle-zod`
- 検証: **Zod** 単一（Elysia は Standard Schema 経由、TypeBox 不使用）
- LLM: **Vercel AI SDK**（AI Gateway 経由、`anthropic/claude-haiku-4.5`）
- Generative UI: **OpenUI**（`@openuidev/react-lang` の `<Renderer>`、`react-ui` の `openuiChatLibrary`）
- Web MCP: **`@mcp-b/*`**（`registerTool` + 全 mutation elicitation ゲート）
- エラー境界: **better-result**（`Result.tryPromise` 等）
- UI: **HeroUI v3** + Tailwind v4 + `cnfast`

## 用語（their terminology）

- **defs / adapters** — ツールは `tools/defs/`（meta 定義 1 箇所）→ `tools/adapters/{ai-sdk,web-mcp,tool-provider}.ts`（3 サーフェス変換）の単一ソースパターン
- **Pattern A / Pattern B** — 書き込みは AI SDK server tools（`needsApproval`）、読み取りは OpenUI `<Renderer toolProvider>` の `Query()`
- **core ドメイン例外** — feature 間の peer import は禁止だが `tasks` のみ例外。今回 `weather` も core 化する（`docs/weather-genui-spec.md` §5）
- **TASK_TOOL_POLICY** — `mutates` / `needsApproval` を一元管理する単一ソース定数（`src/features/tasks/tools/defs/index.ts`）

## 現在進行中の loop

- **loop**: `docs/weather-genui-spec.md` の実装（天気ウィジェット／天気連動タスク順序提案／タスクチャート）
- workflow spec 3 本を作成済み（grilling 完了）:
  - `workflows/phase-1-foundation.md` — 基盤 + チャット内提案（起点）
  - `workflows/phase-2-apply.md` — 適用 + チャット外展開（Phase 1 承認後）
  - `workflows/phase-3-charts.md` — タスクチャート（依存なし、いつでも実行可）
- 各 spec は「実装 agent が質問なしで着手できる」粒度まで具体化済み（stage/ファイル/TDD 範囲/effort まで明記）。

## grilling で確定した構造決定（再利用可能な方針）

- **分割単位**: phase ごとに別 workflow spec（3本）。依存する phase は前 phase の承認を待って手動トリガー。依存しない phase は並列実行可。
- **TDD**: ロジック層（Result/service/Elysia ルート/純粋関数）は Red-Green 必須。UI 表示・system prompt 文言は対象外。
- **isolation**: worktree は使わない。依存パイプラインで直列化し、同一ファイルを触る stage 同士は順序で衝突回避。ファイル単位では最大並列。
- **effort/model**: 実装 stage は `medium`、spec 適合レビュー stage はセッション既定（xhigh）を継承。
- **checkpoint**: 各 phase の最終 stage は「spec 適合レビュー agent」。その後コーディネーターが `vp check/test/build` 結果＋findings を 1 回の brief にまとめ、`AskUserQuestion` で次 phase 進行を確認（push right）。
- **trigger**: 全 phase 手動テキストコマンド。自動連鎖なし。

## 次に必要なアクション（このセッションの続き）

- ユーザーから「phase 1 実行して」等の指示を受けたら、該当 `workflows/phase-N-*.md` を読み、`Workflow` ツールの script に翻訳して起動する。
