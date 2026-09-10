import path from "node:path";
import { type Plugin, tool } from "@opencode-ai/plugin";
import { getScriptCommand, runProcess, selectScript } from "./script-runner.ts";

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
          const scriptPath = selectScript(resolvePath(root, config.createScript));
          const input = JSON.stringify({ name: args.name, directory: context.directory || directory || root });
          const [command, ...commandArgs] = getScriptCommand(
            scriptPath,
            config.powershellCommand,
          );

          const result = await runProcess(
            command,
            commandArgs,
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
          const scriptPath = selectScript(resolvePath(root, config.setupScript));
          const [command, ...commandArgs] = getScriptCommand(
            scriptPath,
            config.powershellCommand,
            ["-WorktreePath", target, "-Action", "setup"],
          );

          const result = await runProcess(
            command,
            commandArgs,
            { cwd: root },
          );

          return `Worktree setup completed for: ${target}\n\n${result.stdout}${result.stderr}`.trim();
        },
      }),
    },
  };
}) satisfies Plugin;
