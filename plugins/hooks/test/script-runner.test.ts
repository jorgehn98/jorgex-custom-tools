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
  assert.equal(selectScript(nodeScript), powershellScript);
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

test("preserves the configured path casing when falling back", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hooks-runner-"));
  const powershellScript = path.join(root, "worktree-create.PS1");
  const nodeScript = path.join(root, "setup-worktree.MJS");
  await writeFile(powershellScript, "Write-Output fallback\n");
  await writeFile(nodeScript, "console.log('setup')\n");

  assert.equal(selectScript(powershellScript), powershellScript);
  assert.equal(selectScript(nodeScript), nodeScript);
});

test("passes setup arguments to both runtimes", () => {
  const args = ["-WorktreePath", "/tmp/example", "-Action", "setup"];

  assert.deepEqual(getScriptCommand("setup.mjs", "pwsh", args), [
    "node",
    "setup.mjs",
    ...args,
  ]);
  assert.deepEqual(getScriptCommand("setup.ps1", "pwsh", args), [
    "pwsh",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "setup.ps1",
    ...args,
  ]);
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
