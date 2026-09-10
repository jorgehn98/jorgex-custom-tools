import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getScriptCommand,
  runProcess,
  selectScript,
} from "../src/script-runner.ts";

test("prefers the sibling Node script and falls back to PowerShell", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hooks-runner-"));
  const powershellScript = path.join(root, "worktree-create.ps1");
  const nodeScript = path.join(root, "worktree-create.mjs");

  await writeFile(powershellScript, "Write-Output fallback\n");
  assert.equal(selectScript(powershellScript), powershellScript);
  assert.deepEqual(getScriptCommand(powershellScript, "pwsh"), [
    "pwsh",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    powershellScript,
  ]);

  await writeFile(nodeScript, "console.log('node selected')\n");
  assert.equal(selectScript(powershellScript), nodeScript);
  assert.deepEqual(getScriptCommand(nodeScript, "pwsh"), ["node", nodeScript]);
});

test("preserves stdout and stderr from Node scripts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hooks-runner-"));
  const nodeScript = path.join(root, "setup-worktree.mjs");
  await writeFile(
    nodeScript,
    "process.stdout.write('worktree-path\\n'); process.stderr.write('diagnostic\\n');\n",
  );

  const result = await runProcess("node", [nodeScript], { cwd: root });

  assert.equal(result.stdout, "worktree-path\n");
  assert.equal(result.stderr, "diagnostic\n");
});
