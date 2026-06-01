import type { Tool, ToolResult } from "../types/tool.js";
import { run, hasBinary } from "./cli-utils.js";

const FRIDA_BIN = process.env.FRIDA_BIN || "frida";
const FRIDA_SERVER_BIN = process.env.FRIDA_SERVER_BIN || "frida-server";

export const fridaTool: Tool = {
  name: "frida",

  async execute(inputs: Record<string, unknown>): Promise<ToolResult> {
    const available = await hasBinary(FRIDA_BIN);
    if (!available) {
      return {
        success: false,
        outputs: {},
        stderr: `frida not found. Install with: pip install frida-tools`,
      };
    }

    const action = (inputs.action as string) || "inject";

    try {
      switch (action) {
        case "inject": {
          const pkg = inputs.package as string;
          const script = inputs.script as string;
          const device = inputs.device as string | undefined;

          if (!pkg) return fail("Missing required input: package");
          if (!script) return fail("Missing required input: script");

          const args = device ? ["-D", device] : ["-U"];
          args.push("-l", script, "-o", "json", pkg);

          const result = await run(FRIDA_BIN, args, {
            timeout: (inputs.timeout as number) || 120_000,
          });

          return {
            success: result.exitCode === 0,
            stdout: result.stdout,
            stderr: result.stderr,
            outputs: { data: result.stdout },
          };
        }

        case "ps": {
          const device = inputs.device as string | undefined;
          const args = device ? ["-D", device, "-D"] : ["-U"];
          args.pop(); // frida-ps doesn't use -D the same way, just use -U or -R
          const psArgs = device ? ["-D", device] : ["-U"];

          const result = await run("frida-ps", psArgs, { timeout: 15_000 });
          return {
            success: result.exitCode === 0,
            stdout: result.stdout,
            stderr: result.stderr,
            outputs: { process_list: result.stdout },
          };
        }

        case "start-server": {
          const device = inputs.device as string | undefined;
          const adbBin = process.env.ADB_BIN || "/usr/lib/android-sdk/platform-tools/adb";

          // Push and start frida-server on device via ADB
          const pushArgs = device ? ["-s", device, "push", FRIDA_SERVER_BIN, "/data/local/tmp/frida-server"] : ["push", FRIDA_SERVER_BIN, "/data/local/tmp/frida-server"];
          const pushResult = await run(adbBin, pushArgs, { timeout: 30_000 });
          if (pushResult.exitCode !== 0) {
            return fail(`Failed to push frida-server: ${pushResult.stderr}`);
          }

          const chmodArgs = device
            ? ["-s", device, "shell", "chmod", "755", "/data/local/tmp/frida-server"]
            : ["shell", "chmod", "755", "/data/local/tmp/frida-server"];
          await run(adbBin, chmodArgs, { timeout: 10_000 });

          const startArgs = device
            ? ["-s", device, "shell", "/data/local/tmp/frida-server", "-D", "&"]
            : ["shell", "/data/local/tmp/frida-server", "-D", "&"];
          const startResult = await run(adbBin, startArgs, { timeout: 10_000 });

          return {
            success: true,
            stdout: startResult.stdout,
            stderr: startResult.stderr,
            outputs: { message: "frida-server started on device" },
          };
        }

        case "stop-server": {
          const device = inputs.device as string | undefined;
          const adbBin = process.env.ADB_BIN || "/usr/lib/android-sdk/platform-tools/adb";
          const args = device
            ? ["-s", device, "shell", "killall", "frida-server"]
            : ["shell", "killall", "frida-server"];
          const result = await run(adbBin, args, { timeout: 10_000 });
          return {
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
            outputs: { message: "frida-server stopped" },
          };
        }

        default:
          return fail(`Unknown frida action: ${action}`);
      }
    } catch (err) {
      return fail(`frida ${action} failed: ${String(err)}`);
    }
  },
};

function fail(msg: string): ToolResult {
  return { success: false, outputs: {}, stderr: msg };
}
