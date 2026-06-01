import type { Tool, ToolResult } from "../types/tool.js";
import { run, hasBinary } from "./cli-utils.js";

const AAPT_BIN = process.env.AAPT_BIN || "aapt";

export const aaptTool: Tool = {
  name: "aapt",

  async execute(inputs: Record<string, unknown>): Promise<ToolResult> {
    const apk = inputs.apk as string | undefined;
    if (!apk) return { success: false, outputs: {}, stderr: "Missing required input: apk" };

    const available = await hasBinary(AAPT_BIN);
    if (!available) {
      return { success: false, outputs: {}, stderr: `aapt not found. Install with: apt install aapt` };
    }

    try {
      const result = await run(AAPT_BIN, ["dump", "badging", apk], { timeout: 30_000 });
      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        outputs: {},
      };
    } catch (err) {
      return { success: false, outputs: {}, stderr: `aapt failed: ${String(err)}` };
    }
  },
};
