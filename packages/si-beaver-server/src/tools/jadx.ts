import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Tool, ToolResult } from "../types/tool.js";
import { run, hasBinary } from "./cli-utils.js";

const JADX_BIN = process.env.JADX_BIN || "jadx";

async function ensureOutputDir(apkPath: string, provided?: string): Promise<string> {
  if (provided) {
    await mkdir(provided, { recursive: true });
    return provided;
  }
  const dir = await mkdtemp(join(tmpdir(), "sibeaver-jadx-"));
  return dir;
}

export const jadxTool: Tool = {
  name: "jadx",

  async execute(inputs: Record<string, unknown>): Promise<ToolResult> {
    const apk = inputs.apk as string | undefined;
    if (!apk) {
      return { success: false, outputs: {}, stderr: "Missing required input: apk" };
    }

    const available = await hasBinary(JADX_BIN);
    if (!available) {
      return {
        success: false,
        outputs: {},
        stderr: `jadx not found. Install with: brew install jadx (macOS) or download from https://github.com/skylot/jadx`,
      };
    }

    const outputDir = await ensureOutputDir(apk, inputs.output_dir as string | undefined);

    const args = ["-d", outputDir];
    if (inputs.no_res) args.push("--no-res");
    if (inputs.no_imports) args.push("--no-imports");
    args.push(apk);

    try {
      const result = await run(JADX_BIN, args, { timeout: 600_000 });
      if (result.exitCode !== 0) {
        return {
          success: false,
          outputs: { source_dir: outputDir },
          stdout: result.stdout,
          stderr: result.stderr || `jadx exited with code ${result.exitCode}`,
        };
      }
      return {
        success: true,
        outputs: { source_dir: outputDir },
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (err) {
      return {
        success: false,
        outputs: {},
        stderr: `jadx execution failed: ${String(err)}`,
      };
    }
  },
};
