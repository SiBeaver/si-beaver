const EXPR_PATTERN = /\$\{\{\s*(.+?)\s*\}\}/g;

const PATH_RE = /^(?:params|tasks)\.|^(?:stdout|stderr)$/;
const EXTRACT_RE = /^extract\(\s*([^,]+?)\s*,\s*['"](.+?)['"]\s*\)$/;

export interface EvalContext {
  params: Record<string, unknown>;
  taskOutputs: Record<string, Record<string, unknown>>;
  /** Current task's raw outputs (stdout, stderr) for use in output declarations */
  self?: Record<string, unknown>;
}

/**
 * Resolve all ${{ }} expressions in a string. If the entire string is a single
 * ${{ }} block, the raw expression value is returned (preserving type).
 * Otherwise, expressions are string-interpolated.
 */
export function resolveExpressions(input: unknown, context: EvalContext): unknown {
  if (typeof input !== "string") return input;

  const trimmed = input.trim();
  const singleMatch = /^\$\{\{\s*(.+?)\s*\}\}$/.exec(trimmed);
  if (singleMatch) {
    return evaluateExpr(singleMatch[1], context);
  }

  return input.replace(EXPR_PATTERN, (_, expr: string) => {
    const value = evaluateExpr(expr.trim(), context);
    return value === undefined || value === null ? "" : String(value);
  });
}

/**
 * Recursively resolve expressions in an object/array.
 */
export function resolveDeep(value: unknown, context: EvalContext): unknown {
  if (typeof value === "string") return resolveExpressions(value, context);
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, context));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveDeep(val, context);
    }
    return result;
  }
  return value;
}

/**
 * Evaluate a single expression body (the content between ${{ and }}).
 *
 * Grammar (in precedence order):
 *   expr       := comparison
 *   comparison := coalesce (("!=" | "==") coalesce)?
 *   coalesce   := primary ("||" primary)*
 *   primary    := extract_call | path_ref | string_literal
 */
export function evaluateExpr(expr: string, context: EvalContext): unknown {
  const trimmed = expr.trim();

  // == and != comparisons (lowest precedence after coalescing)
  for (const op of ["!=", "=="] as const) {
    const idx = findOperator(trimmed, op);
    if (idx !== -1) {
      const left = evaluateExpr(trimmed.slice(0, idx), context);
      const right = evaluateExpr(trimmed.slice(idx + op.length), context);
      if (op === "!=") return !isEqual(left, right);
      return isEqual(left, right);
    }
  }

  if (trimmed.includes("||")) {
    const parts = splitCoalesce(trimmed);
    for (const part of parts) {
      const value = evaluateExpr(part, context);
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }
    return undefined;
  }

  if (EXTRACT_RE.test(trimmed)) {
    return evalExtract(trimmed, context);
  }

  if (PATH_RE.test(trimmed)) {
    return resolvePath(trimmed, context);
  }

  // quoted string literal
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function findOperator(expr: string, op: string): number {
  let depth = 0;
  for (let i = 0; i < expr.length - op.length + 1; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    else if (depth === 0 && expr.slice(i, i + op.length) === op) {
      return i;
    }
  }
  return -1;
}

function splitCoalesce(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length - 1; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    else if (depth === 0 && expr[i] === "|" && expr[i + 1] === "|") {
      parts.push(expr.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

/**
 * Resolve a dot-path reference: params.xxx or tasks.taskName.outputs.xxx
 */
function resolvePath(path: string, context: EvalContext): unknown {
  const segments = path.split(".");

  if (segments[0] === "stdout" || segments[0] === "stderr") {
    if (context.self) return context.self[segments[0]];
    return undefined;
  }

  if (segments[0] === "params") {
    return getNested(context.params, segments.slice(1));
  }

  if (segments[0] === "tasks") {
    const taskName = segments[1];
    const outputs = context.taskOutputs[taskName];
    if (!outputs) return undefined;
    if (segments.length === 2) return outputs;
    const subPath = segments.slice(2);
    if (subPath[0] === "outputs") {
      return getNested(outputs, subPath.slice(1));
    }
    return getNested(outputs, subPath);
  }

  return undefined;
}

/**
 * Handle extract(source, 'regex') function call.
 * Runs regex on the resolved source and returns first capture group.
 */
function evalExtract(expr: string, context: EvalContext): unknown {
  const match = EXTRACT_RE.exec(expr);
  if (!match) return undefined;

  const [, source, regexStr] = match;

  let sourceValue: unknown;
  if (PATH_RE.test(source)) {
    sourceValue = resolvePath(source, context);
  } else {
    sourceValue = source;
  }

  const str = sourceValue !== null && sourceValue !== undefined ? String(sourceValue) : "";
  const re = new RegExp(regexStr);
  const m = re.exec(str);
  return m ? m[1] ?? m[0] : undefined;
}

function getNested(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
