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

## Phase 1〜3 完了・コミット済み（2026-07-03, commit `5d91e40`）

3 phase とも実装 → 敵対的レビュー → 修正 → 再検証のループを最低 1 回ずつ回してから完了。学びを追記:

- **Workflow 実行前の recon は必須**: ルールドキュメントの「target convention」と実コードの実装が食い違うことがある（例: `tools/defs/` + `adapters/` に分かれる想定だったが実際は `tools/*.ts` が単一ファイルでツール定義兼 Web MCP 実行を兼ねる）。agent プロンプトに実ファイルパス・実パターンを埋め込む前に必ず自分で数ファイル読むこと。
- **Zod の Date 型は JSON Schema 化できない**: `z.coerce.date()` を Web MCP/AI SDK の tool inputSchema に使うと `z.toJSONSchema()` が例外を投げ、**その1ツールだけでなく同じ関数内で登録される全ツールの登録が丸ごと止まる**（Phase 1 の実際の regression）。日付は `z.iso.date()`（文字列）で受け、DB 書き込み境界で `new Date()` 変換する。
- **「every tool exposed」系のテストは静的フラグしか見ないことがある**: `taskTools` 配列の `exposeToWebMcp` フラグを見るテストは、実際に `navigator.modelContext` へ登録する hook（本 repo では `use-task-tools.ts`）が新ツールを手動列挙し忘れていても検出しない。レビュー時は「本当に呼び出せるか」を instrumented test で実証させること。
- **同一ファイルへの複数 agent 同時編集はほぼ確実に衝突/手戻りを生む**: Phase 1 で `task-model.ts` を 3 agent が並行編集し、"merge conflict handling" の自己申告が必要になった。以降は fix-plan の Wave 分析のように、事前にファイル競合グラフを描いてから並列度を決める。
- **`git checkout -- <dir>` のような一括 revert はガードで拒否されうる**: 意図しないフォーマット差分（`vp check --fix` の副作用）の後始末は、ユーザー自身の操作に委ねるか、個別ファイル単位で対応する。

## fix-plan workflow（2026-07-03 grilling で追加）

- `docs/weather-genui-review.md`（3 軸レビュー: Standards/Spec/Security、計 27 指摘）→ `docs/weather-genui-fix-plan.md`（Wave A〜G）→ `workflows/fix-plan.md`（単一 workflow spec）という流れ。
- **今回は Phase 1〜3 と違い workflow を 1 本に集約**: Wave 間のファイル依存が密（`apply-reorder.ts` 等 8 ファイルが 2 つ以上の Wave にまたがる）ため、独立起動可能な複数ファイルに分ける前提が崩れた。分割単位は「ファイル競合グラフを描いて依存が薄いかどうか」で判断すること — 密なら 1 本のパイプライン、疎なら Phase 方式（複数ファイル）。
- **大規模フェーズの合間はコミットでチェックポイントを切る**: 70+ ファイル未コミットのまま次の大改修に入るとレビューの固定点（HEAD）がずれる。ユーザーに確認の上 `5d91e40` で一度コミットした。
- **pre-commit hook（react-doctor）は React Compiler 非対応構文を検出する**: `try` 文（catch のみ・finally 付き含む）はコンポーネント本体内で丸ごと非対応。`.catch()/.finally()` のような promise チェーンに書き換えて回避する。
- **`.agents/skills/` と `.claude/skills/` は別ディレクトリ**（symlink ではない）。`.agents/` は git 管理下、`.claude/` は未追跡。ミラーリングの実体は未解明だが、loop-me のワークスペース（NOTES.md・workflows/）は両方に出現しうる。
