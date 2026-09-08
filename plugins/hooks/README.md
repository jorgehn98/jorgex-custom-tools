# @jorgex/hooks — OpenCode hooks plugin

Generic hooks plugin for OpenCode. Runs scripts on session/tool events, driven by
`hooks.json` files. It loads and merges hooks from two scopes:

- **Project**: `<project>/.opencode/hooks.json`
- **Global (user-level)**: `~/.config/opencode/hooks.json`

Each script is resolved against the config that declared it (project scripts against
the project dir, global scripts against `~/.config/opencode`). Both scopes are merged,
so a project can add scripts on top of the global ones.

> Exports: `HooksPlugin` (hooks) and `WorktreePlugin` (worktree) from `src/`.
> Previously named `photo-heart-hooks`; renamed to `hooks` to be project-agnostic.

---

## hooks.json format

```json
{
  "session.created": { "*": ["scripts/foo.cjs"] },
  "tool.execute.after": {
    "supabase_apply_migration": ["scripts/save-migration.cjs"],
    "bash": {
      "gh pr create": ["scripts/post-pr-review.cjs"],
      "gh pr merge": ["scripts/post-merge-cleanup.ps1"]
    }
  }
}
```

- A tool entry is either an **array of scripts** or, for `bash`, a **map of command
  triggers** (`"gh pr create": [...]`). A trigger matches when the command contains it.
- Supported script types: `.cjs`/`.js`/`.mjs` (node), `.ps1` (powershell), `.sh` (bash).
- Script stdout/stderr is injected back into the tool output for the model to read.

### Triggers in use (today)

PR review and merge are triggered via **bash commands**, not MCP tools:

- `gh pr create` → post-PR actions (e.g. global review hook)
- `gh pr merge` → post-merge cleanup

---

## Hardening history (resolved)

The plugin went through two hardening passes. Kept here as a reference for the
non-obvious gotchas, since they are easy to re-introduce.

### Fase 1 — config parser

The `bash` node can be an array OR a trigger map. Earlier code did unsafe casts
(`as string[]`), causing `{} is not iterable` and breaking every bash command.

Fixed with validation helpers and a "invalid config = warn + skip, never throw" rule:
`isStringArray()`, `isPlainObject()`, `getEventConfig()`, `getToolScripts()`,
`getBashTriggerScripts()`, `logInvalidHookConfig()`. Applied to both
`tool.execute.after` and `tool.execute.before`.

### Fase 2 — Windows runtime bugs

1. **`bash` not in PATH** — `Bun.spawn` on Windows doesn't inherit Git Bash paths.
   `resolveBash()` looks for `bash.exe` in known Git for Windows locations
   (`C:/Program Files/Git/usr/bin/bash.exe`, etc.), with `BASH_PATH` and `bash` fallbacks.

2. **coreutils missing** (`cat`, `grep`, `head`, `dirname`) — for `.sh` scripts the
   spawned process needs `C:/Program Files/Git/usr/bin` injected into `env.PATH`.

3. **MCP tool output not reaching the model** — `appendToolOutput()` must handle both
   formats: built-in tools use `output.output` (string); MCP tools use `output.content`
   (array of `{type:"text", text}` blocks). Always check `typeof` / `Array.isArray`.

---

## Reference notes

### Output format by tool type

| Tool type                                      | output keys                          | Output format                              |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| Built-in (bash, edit, read, write, glob, grep) | title, metadata, output, attachments | `output.output` is a **string**            |
| MCP (github_*, supabase_*, stripe_*, etc.)     | content                              | `output.content` is an **array** of blocks |

### MCP tool names in plugin events

MCP tools arrive **without** the `mcp_` prefix:

- `mcp_github_create_pull_request` → `input.tool = "github_create_pull_request"`
- `mcp_supabase_apply_migration` → `input.tool = "supabase_apply_migration"`

### Diagnosing

If hooks misbehave, temporarily add a debug log writing to
`{directory}/hooks-debug.log` with `fs.appendFileSync` to capture `input.tool`,
resolved scripts, returned messages, and `output.output`/`output.content` before/after
`appendToolOutput`. Remove it afterwards. (`client.app.log` output isn't always visible.)

---

## Lessons learned

1. `Bun.spawn` on Windows doesn't inherit Git Bash paths — resolve `bash.exe` and inject
   Git coreutils into `env.PATH` for `.sh` scripts.
2. MCP and built-in tools have different output shapes — handle both.
3. A hooks plugin must never block a tool: invalid config = warn + skip; failed script =
   log + continue. Only very explicit exceptions should abort.
4. Smoke tests aren't enough — some bugs (MCP output) only surfaced on a real end-to-end PR.

---

## Possible improvements

- [ ] Verify `gh pr merge` cleanup end-to-end on a real merge.
- [ ] Extract `resolveBash()` and `appendToolOutput()` into a shared module to avoid
      duplication between `src/hooks.ts` and `src/worktree-plugin.ts`.

> Done previously: removed the temporary `_dbg` debug block; renamed package to `@jorgex/hooks`.
