import { registerTool } from "./registry.js";
import { jadxTool } from "./jadx.js";
import { adbTool } from "./adb.js";
import { fridaTool } from "./frida.js";
import { aaptTool } from "./aapt.js";

export function initTools() {
  registerTool(jadxTool);
  registerTool(adbTool);
  registerTool(fridaTool);
  registerTool(aaptTool);
}
