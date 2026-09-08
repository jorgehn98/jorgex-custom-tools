import { spawn } from "node:child_process";
import path from "node:path";
import { type Plugin, tool } from "@opencode-ai/plugin";

type RunResult = {
  stdout: string;
  stderr: string;
};

type WorktreeToolsOptions = {
  createToolName?: string;
  setupToolName?: string;
  createScript?: string;
  setupScript?: string;
  powershellCommand?: string;
  openTerminalDefault?: boolean;
  terminalCommand?: string[];
  reminderLines?: string[];
};

const isAbsolutePath = (value: string) =>
  /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/");

const resolvePath = (root: string, target: string) =>
  isAbsolutePath(target) ? target : path.join(root, target);

const replaceToken = (value: string, token: string, replacement: string) =>
  value.split(token).join(replacement);

const renderTemplate = (value: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce(
    (result, [key, replacement]) => replaceToken(result, `{${key}}`, replacement),
    value,
  );

const runProcess = (
  command: string,
  args: string[],
  options: { cwd: string; stdin?: string; detached?: boolean },
) => {
  return new Promise<RunResult>((resolve, reject) => {
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

    if (options.stdin) {
      child.stdin?.write(options.stdin);
    }
    child.stdin?.end();
  });
};

const getProjectRoot = (context: { worktree?: string; directory?: string }, fallback: { worktree?: string; directory?: string }) =>
  context.worktree || fallback.worktree || context.directory || fallback.directory || process.cwd();

const defaultOptions: Required<WorktreeToolsOptions> = {
  createToolName: "project_worktree_create",
  setupToolName: "project_worktree_setup_current",
  createScript: "scripts/worktree/worktree-create.ps1",
  setupScript: "scripts/worktree/setup-worktree.ps1",
  powershellCommand: process.platform === "win32" ? "powershell.exe" : "pwsh",
  openTerminalDefault: false,
  terminalCommand: ["wt.exe", "-d", "{worktreePath}", "pwsh", "-NoExit", "-Command", "opencode"],
  reminderLines: [],
};

export default (async ({ directory, worktree }, options?: WorktreeToolsOptions) => {
  const config = { ...defaultOptions, ...(options || {}) };

  return {
    tool: {
      [config.createToolName]: tool({
        description:
          "Create a git worktree by running a project-provided script. The script receives JSON on stdin and must print the worktree path to stdout.",
        args: {
          name: tool.schema.string().describe("Worktree name passed to the create script."),
          openTerminal: tool.schema
            .boolean()
            .optional()
            .describe("Open a terminal using the configured terminalCommand after creation."),
        },
        async execute(args, context) {
          const root = getProjectRoot(context, { directory, worktree });
          const scriptPath = resolvePath(root, config.createScript);
          const input = JSON.stringify({ name: args.name, directory: context.directory || directory || root });

          const result = await runProcess(
            config.powershellCommand,
            ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
            { cwd: root, stdin: input },
          );

          const worktreePath = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
          if (!worktreePath) {
            throw new Error(`Worktree create script did not return a path.\n${result.stderr}`.trim());
          }

          const shouldOpenTerminal = args.openTerminal ?? config.openTerminalDefault;
          let terminalNote = "Terminal auto-open skipped.";

          if (shouldOpenTerminal) {
            const terminalCommand = config.terminalCommand.map((part) =>
              renderTemplate(part, { worktreePath, name: args.name }),
            );
            const [command, ...terminalArgs] = terminalCommand;
            if (!command) {
              terminalNote = "Terminal command is empty; skipped.";
            } else {
              await runProcess(command, terminalArgs, { cwd: root, detached: true });
              terminalNote = `Opened terminal: ${terminalCommand.join(" ")}`;
            }
          }

          const reminderLines = config.reminderLines.map((line) =>
            renderTemplate(line, { worktreePath, name: args.name }),
          );

          return [`Worktree ready: ${worktreePath}`, terminalNote, ...reminderLines].filter(Boolean).join("\n");
        },
      }),

      [config.setupToolName]: tool({
        description: "Run the configured worktree setup script in the current directory.",
        args: {},
        async execute(_args, context) {
          const root = getProjectRoot(context, { directory, worktree });
          const target = context.directory || directory || root;
          const scriptPath = resolvePath(root, config.setupScript);

          const result = await runProcess(
            config.powershellCommand,
            ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-WorktreePath", target, "-Action", "setup"],
            { cwd: root },
          );

          return `Worktree setup completed for: ${target}\n\n${result.stdout}${result.stderr}`.trim();
        },
      }),
    },
  };
}) satisfies Plugin;
