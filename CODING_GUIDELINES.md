# コーディング規約（概要）

このドキュメントは本プロジェクト（Generative UI と Web MCP のキャッチアップ実験。背景は [CLAUDE.md](./CLAUDE.md) を参照）の規約の**人間向け概説**です。

> **Single Source of Truth は `.claude/rules/**`。** 各規約の正本はそちらにあり、セッション開始時に自動ロードされます。本ファイルは全体像と設計思想だけを示し、詳細は再掲しません。記述が食い違う場合は `.claude/rules/\*\*` を優先してください。

## スタック

| 領域           | 採用                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| フレームワーク | TanStack Start + Router、React 19（React Compiler を Babel で有効化）                                                                                |
| スタイル       | Tailwind CSS v4 + react-ui プリコンパイル CSS（`cn` は `cnfast`）                                                                                    |
| 生成 UI        | OpenUI（`@openuidev/react-lang` / `react-headless` / `react-ui`）                                                                                    |
| LLM            | Vercel AI SDK v6（`ai`）+ Vercel AI Gateway（`AI_GATEWAY_API_KEY`、server-only、model 例 `anthropic/claude-haiku-4.5`）                              |
| Web MCP        | MCP-B polyfill（`navigator.modelContext`）                                                                                                           |
| 検証           | Zod（単一）                                                                                                                                          |
| フォーム       | TanStack Form（Standard Schema 経由で Zod を直結、アダプタ不要）                                                                                     |
| エラー処理     | better-result                                                                                                                                        |
| バックエンド   | ElysiaJS（API 層、`src/routes/api.$.ts` に `app.fetch` で Node マウント）+ Eden Treaty。Bun 不採用。チャットのストリーミングのみ native server route |
| DB             | Turso（libsql）+ Drizzle ORM（`drizzle-zod`、`drizzle-typebox` は不使用）                                                                            |
| ツールチェーン | Vite+（`vp`、[AGENTS.md](./AGENTS.md) 参照）。pnpm 維持                                                                                              |

> **現状 vs 目標:** 上記の多くは**まだ未配線の目標規約**です（[CLAUDE.md](./CLAUDE.md) 参照）。依存は導入済みでも、`~/features/*` 等を import する前にそのモジュールが実在するか必ず確認してください。

## 規約の所在（正本）

| トピック                                          | 正本                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| プロジェクト構造 / `features/*` / `~` エイリアス  | [typescript/project-structure.md](./.claude/rules/typescript/project-structure.md) |
| React / 型 / named export / 関数宣言 / Utility 型 | [typescript/react-conventions.md](./.claude/rules/typescript/react-conventions.md) |
| コードスタイル / 命名 / 不変性 / hook 禁止事項    | [common/coding-style.md](./.claude/rules/common/coding-style.md)                   |
| Zod 検証                                          | [typescript/zod-validation.md](./.claude/rules/typescript/zod-validation.md)       |
| better-result                                     | [typescript/better-result.md](./.claude/rules/typescript/better-result.md)         |
| Generative UI（OpenUI）                           | [web/generative-ui.md](./.claude/rules/web/generative-ui.md)                       |
| Web MCP                                           | [web/web-mcp.md](./.claude/rules/web/web-mcp.md)                                   |
| AI ストリーミング（Vercel AI SDK + Claude）       | [web/ai-streaming.md](./.claude/rules/web/ai-streaming.md)                         |
| バックエンド（Elysia / Drizzle / Eden / Turso）   | [web/backend-elysia-drizzle.md](./.claude/rules/web/backend-elysia-drizzle.md)     |
| スタイリング（Tailwind v4 / react-ui CSS / cn）   | [web/styling.md](./.claude/rules/web/styling.md)                                   |
| 開発ワークフロー（`vp`）                          | [common/development-workflow.md](./.claude/rules/common/development-workflow.md)   |
| テスト                                            | [common/testing.md](./.claude/rules/common/testing.md)                             |
| セキュリティ                                      | [common/security.md](./.claude/rules/common/security.md)                           |

## 設計思想（rules に属さない原則）

### 型の Single Source of Truth

型は一箇所で定義し、派生型は `Pick` / `Omit` / `z.infer` などで生成します。定数は `as const satisfies` でリテラル型を保持します（詳細は react-conventions）。

### AHA Programming

[AHA Programming](https://kentcdodds.com/blog/aha-programming)（Avoid Hasty Abstractions）に従います。

> "prefer duplication over the wrong abstraction"（間違った抽象化よりも重複を選ぶ）— Sandi Metz

1. 最初は重複を許容する（パターンが明確になるまで待つ）
2. 3 回目の重複で抽象化を検討する
3. 間違った抽象化は重複より高コスト

### コメント規約

- コメントは日本語で書く
- [Better Comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments) 形式のプレフィックスを使う:
  - `//*` — モジュール/セクションの概要
  - `//?` — 設計判断や「なぜそうしているか」（「何をしているか」ではなく理由を書く）
  - `//!` — 重要な注意・制約・TODO
- CSS ではブロックコメントに `/* *` / `/* ?` / `/* !` を使う
- ツール指令（`/// <reference ...>`、`// @vitest-environment` など）はそのまま維持する
- TODO コメントには担当者と期限を記載する: `//! TODO(@username 2026-09): ...`

## 参考リンク

- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [TanStack Start](https://tanstack.com/start) / [Router](https://tanstack.com/router)
- [OpenUI](https://www.openui.com/docs/openui-lang/quickstart)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [MCP-B (WebMCP polyfill)](https://mcp-b.ai/)
- [Zod](https://zod.dev/) / [TanStack Form](https://tanstack.com/form)
- [better-result](https://github.com/dmmulroy/better-result)
- [Tailwind CSS](https://tailwindcss.com/)
- [AHA Programming](https://kentcdodds.com/blog/aha-programming)
