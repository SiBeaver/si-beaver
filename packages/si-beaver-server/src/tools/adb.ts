import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Tool, ToolResult } from "../types/tool.js";
import { run, hasBinary } from "./cli-utils.js";

const ADB_BIN = process.env.ADB_BIN || "/usr/lib/android-sdk/platform-tools/adb";

function deviceArg(device?: string): string[] {
  return device ? ["-s", device] : [];
}

export const adbTool: Tool = {
  name: "adb",

  async execute(inputs: Record<string, unknown>): Promise<ToolResult> {
    const available = await hasBinary(ADB_BIN);
    if (!available) {
      return {
        success: false,
        outputs: {},
        stderr: `adb not found at ${ADB_BIN}. Set ADB_BIN env var to the correct path.`,
      };
    }

    const action = (inputs.action as string) || "devices";
    const device = inputs.device as string | undefined;

    try {
      switch (action) {
        case "devices":
          return adb(deviceArg(device).concat(["devices", "-l"]));
        case "install": {
          const apk = inputs.apk as string;
          if (!apk) return fail("Missing required input: apk");
          return adb(deviceArg(device).concat(["install", "-r", apk]));
        }
        case "uninstall": {
          const pkg = inputs.package as string;
          if (!pkg) return fail("Missing required input: package");
          return adb(deviceArg(device).concat(["uninstall", pkg]));
        }
        case "start": {
          const pkg = inputs.package as string;
          const activity = inputs.activity as string;
          if (!pkg) return fail("Missing required input: package");
          const component = activity ? `${pkg}/${activity}` : pkg;
          return adb(deviceArg(device).concat(["shell", "am", "start", "-n", component]));
        }
        case "logcat": {
          const filter = inputs.filter as string | undefined;
          const args = deviceArg(device).concat(["logcat"]);
          if (filter) args.push("-s", filter);
          return adb(args);
        }
        case "screenshot": {
          const remotePath = "/sdcard/sibeaver_screenshot.png";
          const localPath = join(tmpdir(), `screenshot-${Date.now()}.png`);
          await adb(deviceArg(device).concat(["shell", "screencap", "-p", remotePath]));
          const pull = await adb(deviceArg(device).concat(["pull", remotePath, localPath]));
          if (pull.success) {
            return { ...pull, outputs: { ...pull.outputs, screenshot_path: localPath } };
          }
          return pull;
        }
        case "kill": {
          const pid = inputs.pid as string | number;
          if (!pid) return fail("Missing required input: pid");
          return adb(deviceArg(device).concat(["shell", "kill", String(pid)]));
        }
        case "shell": {
          const cmd = inputs.command as string;
          if (!cmd) return fail("Missing required input: command");
          return adb(deviceArg(device).concat(["shell", cmd]));
        }
        default:
          return fail(`Unknown adb action: ${action}`);
      }
    } catch (err) {
      return fail(`adb ${action} failed: ${String(err)}`);
    }
  },
};

async function adb(args: string[]): Promise<ToolResult> {
  const result = await run(ADB_BIN, args, { timeout: 120_000 });
  return {
    success: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr,
    outputs: {},
  };
}

function fail(msg: string): ToolResult {
  return { success: false, outputs: {}, stderr: msg };
}
