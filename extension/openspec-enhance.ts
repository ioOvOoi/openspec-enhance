import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
	// ── ask_user_question tool ──────────────────────────────────────
	pi.registerTool({
		name: "ask_user_question",
		label: "Ask User",
		description:
			"Ask the user a question when you need clarification, a decision, " +
			"or to select from options. Use when the user's intent is unclear or " +
			"you need them to choose between alternatives.",
		promptSnippet: "Ask the user: {question}",
		parameters: Type.Object({
			question: Type.String({
				description: "The question to ask the user. Be clear and specific.",
			}),
			options: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Optional preset answer choices. If provided, the user picks one. " +
						"If omitted, the user types a free-form answer.",
				}),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (params.options && params.options.length > 0) {
				const answer = await ctx.ui.select(params.question, params.options, {
					signal,
				});
				return {
					content: [
						{
							type: "text",
							text: answer ?? "(no selection / cancelled)",
						},
					],
					details: {},
				};
			}
			const answer = await ctx.ui.input(params.question, "", { signal });
			return {
				content: [
					{
						type: "text",
						text: answer ?? "(no input / cancelled)",
					},
				],
				details: {},
			};
		},
	});

	// ── Skill dispatch helper ──────────────────────────────────────
	function registerOpsx(cmd: string, skill: string, phase: string) {
		pi.registerCommand(cmd, {
			description: `OpenSpec ${phase} · ${skill}`,
			handler: async (args, _ctx) => {
				const prompt = args ? `/skill:${skill} ${args}` : `/skill:${skill}`;
				pi.sendUserMessage(prompt);
			},
		});
	}

	// ── ⓪ INIT ────────────────────────────────────────────────────
	// Runs openspec init --tools pi to generate standard prompts/skills.
	// First run also creates openspec/config.yaml + directory structure.
	pi.registerCommand("opsx-init", {
		description:
			"OpenSpec ⓪ init · Generate prompts/skills via openspec CLI",
		handler: async (_args, ctx) => {
			const root = ctx.cwd;
			const fresh = !existsSync(join(root, "openspec", "config.yaml"));

			const result = await pi.exec("openspec", ["init", "--tools", "pi"], {
				cwd: root,
				timeout: 15000,
			});

			if (result.code !== 0) {
				ctx.ui.notify(
					`openspec init failed: ${result.stderr?.trim() || "unknown error"}`,
					"error",
				);
				return;
			}

			if (fresh) {
				writeFileSync(join(root, "openspec", ".gitignore"), "*\n", "utf-8");
			}

			ctx.ui.notify(
				fresh
					? `openspec/ initialized in ${root}\n` +
						`Standard prompts + skills generated. Run /reload.`
					: `Prompts/skills refreshed. Run /reload.`,
				"success",
			);
		},
	});

	// ── Standard SDD commands ──────────────────────────────────────
	// These are also available as CLI-generated prompt templates
	// under .pi/prompts/. Registering them here via the extension
	// ensures they dispatch correctly and stay in sync.
	//
	//   ① EXPLORE — understand the problem space
	//   ② PROPOSE — define what to build
	//   ③ PLAN    — break into tasks
	//   ④ APPLY   — implement
	//   ⑤ REVIEW  — inspect before merge
	//   ⑥ VERIFY  — validate correctness
	//   ⑦ ARCHIVE — finalize and record
	//   ⑧ DEEPEN  — improve architecture

	// ① EXPLORE
	registerOpsx("opsx-brainstorm", "brainstorming", "① brainstorm");
	registerOpsx("opsx-zoom", "zoom-out", "① zoom out");

	// ② PROPOSE — stress-test design before committing to spec
	registerOpsx("opsx-grill", "grill-me", "② grill design");
	registerOpsx("opsx-docs", "grill-with-docs", "② domain check");

	// ③ PLAN — spec → tracer-bullet vertical slices
	registerOpsx("opsx-plan", "to-issues", "③ plan");

	// ④ APPLY — TDD discipline + worktree isolation
	registerOpsx("opsx-tdd", "test-driven-development", "④ tdd");
	registerOpsx("opsx-worktree", "using-git-worktrees", "④ worktree");

	// ⑤ REVIEW — AI proactively finds issues before human review
	registerOpsx("opsx-review", "requesting-code-review", "⑤ review");

	// ⑥ VERIFY — disciplined diagnose loop
	registerOpsx("opsx-diagnose", "diagnose", "⑥ diagnose");

	// ⑦ CROSS-CUTTING
	registerOpsx("opsx-handoff", "handoff", "⑦ handoff");
	registerOpsx("opsx-deepen", "improve-codebase-architecture", "⑧ deepen");
}
