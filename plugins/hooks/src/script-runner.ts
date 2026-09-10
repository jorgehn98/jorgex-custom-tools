import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type RunResult = {
  stdout: string;
  stderr: string;
};

type RunProcessOptions = {
  cwd: string;
  stdin?: string;
  detached?: boolean;
};

export const selectScript = (configuredPath: string) => {
  const extension = path.extname(configuredPath).toLowerCase();
  if (extension !== ".ps1" && extension !== ".mjs") return configuredPath;

  const basePath = configuredPath.slice(0, -extension.length);
  const nodePath = `${basePath}.mjs`;
  return existsSync(nodePath) ? nodePath : `${basePath}.ps1`;
};

export const getScriptCommand = (
  scriptPath: string,
  powershellCommand: string,
  commandArgs: string[] = [],
) => {
  if (scriptPath.toLowerCase().endsWith(".mjs")) {
    return ["node", scriptPath, ...commandArgs];
  }

  return [
    powershellCommand,
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    ...commandArgs,
  ];
};

export const runProcess = (
  command: string,
  args: string[],
  options: RunProcessOptions,
) =>
  new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: !options.detached,
      detached: options.detached ?? false,
      stdio: options.detached ? "ignore" : ["pipe", "pipe", "pipe"],
    });

    if (options.detached) {
      child.unref();
      resolve({ stdout: "", stderr: "" });
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`.trim()));
    });

    if (options.stdin) child.stdin?.write(options.stdin);
    child.stdin?.end();
  });
