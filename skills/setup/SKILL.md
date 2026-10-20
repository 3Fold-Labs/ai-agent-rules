---
name: setup
description: Walk through the 100-question AI Agent Rules worksheet and write a local policy plus coding tool settings. Use when the user wants to decide what an AI agent may do, choose ALLOW, ASK, DENY, or Doesn't apply, or compile Claude Code, Codex, Gemini CLI, or Cursor settings.
---

# Set up AI agent rules

This skill uses the local `ai-agent-rules` tools: `list_questions`, `explain_answer`, and `compile_answers`. They read the worksheet on this machine. Do not send answers over the network. Do not invent questions. If those tools are not available, say so and point the user to the worksheet at https://3fold-labs.github.io/ai-agent-rules/ or to `node plugin/cli.mjs demo` in a checkout of this repository.

The worksheet has two tracks, Builder and Personal, with 100 questions each. Each answer is ALLOW, ASK, DENY, or Doesn't apply. Unanswered questions grant nothing.

Tool settings are a strong guardrail, not a lock. Cursor's file is guidance only. Nothing here guarantees that a tool will follow the files.

## Steps

1. Ask which track. Builder is for coding and building. Personal is for everyday life. Keep each track's answers separate.
2. Call `list_questions` for that track. Work one section at a time. For each question, show the number, the question, and the suggested answer, then wait.
3. Record ALLOW, ASK, DENY, or Doesn't apply. Notes are optional and hold the scope (a folder, a person, a limit). Leave a question out when the user skips it. Do not fill a skip with ALLOW.
4. A suggested answer is not reviewed until the user chooses it. If they say to use the suggestion without reading it, store `suggested: true`. If they choose the option themselves, store it without `suggested`.
5. Call `explain_answer` when they ask what a choice will mean. An ALLOW that is still suggested reads as ASK. A reviewed ALLOW with notes stays ALLOW in the policy and becomes ask in the tool files.
6. When they want files, call `compile_answers` with the answers they gave. Write every returned file into the project under its `name`. Tell them the `saveAs` path is where that tool reads it. Give them `quickStart` to send with the policy.
7. On the Builder track, the compact policy belongs in the agent's instructions, and the tool file is the guardrail beside it. For Claude Code and Cursor, add the rules to an existing settings file when one is already there. For Codex and Gemini CLI, replace the whole file. On the Personal track there is no tool file. The policy is the instruction.
8. If they want to see the shape of the files before answering, call `compile_answers` with `demo: true` and the track. Label those files as a demo, not their policy.

Do not claim the files force an agent to obey them.
