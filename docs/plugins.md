# Install the local plugin

The plugin is free. It runs on your machine, reads the questions from this repository, and makes no network calls. Each track still has 100 questions. Each answer is ALLOW, ASK, DENY, or Doesn't apply. Unanswered questions grant nothing. Tool settings are a strong guardrail, not a lock. Cursor's file is guidance only.

The browser worksheet at https://3fold-labs.github.io/ai-agent-rules/ stays the primary way to answer. It needs no plugin.

You need Node.js. Nothing is published to a package registry.

## Try the demo

From a checkout of this repository:

```bash
node plugin/cli.mjs demo --out /tmp/ai-agent-rules-demo
```

Open the files in that folder. `my-agent-policy-builder.md` is the policy. The other files are the Claude Code, Codex, Gemini CLI, and Cursor settings for the demo answers. They are a sample, not your policy.

```bash
node plugin/cli.mjs demo --track personal --out /tmp/ai-agent-rules-demo-personal
```

The Personal track writes a policy only.

To talk to the server yourself, start it and send one JSON message per line on stdin:

```bash
node plugin/server.mjs
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "demo", "version": "0"}}
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {"name": "compile_answers", "arguments": {"demo": true, "track": "builder", "date": "2026-09-29"}}
}
```

The result lists each file's name, the path to save it as, and the full text. The server writes nothing and contacts no host.

Tools:

| Tool              | What it does                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_questions`  | Lists one track, or one section. Question text comes from the worksheet.                                                                      |
| `explain_answer`  | Says what ALLOW, ASK, DENY, or Doesn't apply means for one question.                                                                          |
| `compile_answers` | Returns the policy and, on the Builder track, the Claude Code, Codex, Gemini CLI, and Cursor settings. `demo: true` uses the built-in sample. |

In Claude Code, Cursor, or Codex, ask the agent to use the setup skill. In Claude Code the command is `/ai-agent-rules:setup`.

## Claude Code

This repository is the marketplace. From a checkout:

```bash
claude plugin marketplace add .
claude plugin install ai-agent-rules@ai-agent-rules
```

From GitHub, when you want the copy on the default branch:

```bash
claude plugin marketplace add 3Fold-Labs/ai-agent-rules
claude plugin install ai-agent-rules@ai-agent-rules
```

Start a session and run `/ai-agent-rules:setup`, or ask Claude to compile the demo answers. `/mcp` shows the server `ai-agent-rules`. The server command is `node` with `${CLAUDE_PLUGIN_ROOT}/plugin/server.mjs`.

One session, without installing:

```bash
claude --plugin-dir .
```

## Cursor

Cursor loads this repository as one plugin. The manifest is `.cursor-plugin/plugin.json`. The server is `mcp.json`. The walkthrough is `skills/setup/SKILL.md`. `rules/ai-agent-rules.mdc` is available when you ask about permissions. It does not apply to every file.

Copy or clone the repository into Cursor's local plugin folder, then reload the window:

```bash
git clone https://github.com/3Fold-Labs/ai-agent-rules.git ~/.cursor/plugins/local/ai-agent-rules
```

A symlink that points outside `~/.cursor/plugins/local` is not loaded. Use a real directory. Local plugin imports must be allowed. On Teams and Enterprise, an admin controls that setting.

To attach only the server to one project, put this in `.cursor/mcp.json` and use the absolute path to your checkout:

```json
{
  "mcpServers": {
    "ai-agent-rules": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/ai-agent-rules/plugin/server.mjs"]
    }
  }
}
```

## Codex

The Codex plugin manifest is `.codex-plugin/plugin.json`. The marketplace file is `.agents/plugins/marketplace.json`. From a checkout:

```bash
codex plugin marketplace add .
```

Open Codex, run `/plugins`, and install **ai-agent-rules**. Start a new session, then ask it to walk through a track or compile the demo.

To add only the server:

```bash
codex mcp add ai-agent-rules -- node /ABSOLUTE/PATH/ai-agent-rules/plugin/server.mjs
codex mcp list
```

Codex stores that in `~/.codex/config.toml`. The server asks for no key.

## Gemini CLI

`gemini-extension.json` is at the repository root. From a checkout:

```bash
gemini extensions link .
```

Or from GitHub:

```bash
gemini extensions install https://github.com/3Fold-Labs/ai-agent-rules
```

Restart Gemini CLI. `/mcp list` shows `ai-agent-rules`. The extension name matches the repository name.

To add only the server:

```bash
gemini mcp add ai-agent-rules node /ABSOLUTE/PATH/ai-agent-rules/plugin/server.mjs
```

## Any other MCP client

Point a stdio server at Node and the server file. There is no URL.

```json
{
  "mcpServers": {
    "ai-agent-rules": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/ai-agent-rules/plugin/server.mjs"]
    }
  }
}
```

## Where a publisher can list it

This repository does not submit the plugin anywhere. Listing is a separate step for the repository owner. Every listing below is free to submit. None of them is required to install or run the plugin.

| Where                                                     | What it lists                                                   | What it requires                                                                                                                                                                                                                                                                                                                                      | Cost                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| This repository as a Claude Code marketplace              | The plugin, for anyone who runs `claude plugin marketplace add` | The files already in `.claude-plugin/`. No extra account.                                                                                                                                                                                                                                                                                             | Free                                                        |
| Anthropic's plugin directory (claude.ai/directory/manage) | The same plugin on claude.ai, in Cowork, and in Claude Code     | A GitHub account connected on claude.ai, a paid Claude plan (Pro, Max, Team, or Enterprise; Team and Enterprise need an Owner or the Directory role), a public repository before the listing goes live, `claude plugin validate`, and Anthropic's review. The official marketplace `claude-plugins-official` does not take this submission.           | The plugin is free. Submitting requires a paid Claude plan. |
| Cursor Marketplace (cursor.com/marketplace/publish)       | A Cursor plugin                                                 | A public Git repository, `.cursor-plugin/plugin.json`, and a manual review. Plugins must be open source.                                                                                                                                                                                                                                              | Free                                                        |
| cursor.directory                                          | A community plugin                                              | Sign in with GitHub or Google, a public repository, and an automated security scan. It looks for `mcp.json`, `skills/*/SKILL.md`, and `rules/*.mdc`.                                                                                                                                                                                                  | Free to list                                                |
| Codex and ChatGPT plugin directory                        | The Codex plugin                                                | An OpenAI developer account, an organization, identity verification, a ZIP of the plugin, and review. A local stdio server uses the desktop-only path. No fee is stated in the submission docs.                                                                                                                                                       | Free to submit                                              |
| Gemini CLI extension gallery                              | The Gemini extension                                            | A public GitHub repository, `gemini-extension.json` at the root, and the GitHub topic `gemini-cli-extension`. The gallery crawls that topic. No form.                                                                                                                                                                                                 | Free                                                        |
| Official MCP Registry (registry.modelcontextprotocol.io)  | The stdio server                                                | A `server.json` whose `description` is at most 100 characters, a namespace you can prove (for example `io.github.3Fold-Labs`), and a package on npm, PyPI, NuGet, crates.io, or an MCPB bundle on a GitHub release. npm ownership is a matching `mcpName` in `package.json`. Publish with `mcp-publisher`. This package is private and is not on npm. | No fee in the registry docs                                 |
| Smithery                                                  | An MCP server page                                              | An account (GitHub, Google, or email). Smithery connects to a public HTTPS server, or you upload an MCPB bundle for a local stdio server.                                                                                                                                                                                                             | No listing fee in the publish docs                          |
| Glama                                                     | An MCP server page                                              | Write or admin access to the public GitHub repository, a display name, and a short description. Glama builds and scans the repo. Hosting a server on Glama is a paid product. Listing the repository is free.                                                                                                                                         | Free to list                                                |

Do not put a key, token, or filled-in policy in a listing.
