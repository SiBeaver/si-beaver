import type { OperationContext } from '../../operations/context.js';
import type { CapabilityNode, CognitiveNode, TaskNode } from '../../nodes/types.js';
import type { Edge } from '../../edges/types.js';
import type {
  ProjectionTemplate,
  GeneratedProjection,
  ProjectionConfigEntry,
} from '../types.js';

const MATURITY_ORDER: Record<string, number> = {
  deprecated: 0,
  planned: 1,
  alpha: 2,
  beta: 3,
  stable: 4,
};

const MATURITY_BADGE: Record<string, string> = {
  planned: '🔲 Planned',
  alpha: '🧪 Alpha',
  beta: '⚡ Beta',
  stable: '✅ Stable',
  deprecated: '⛔ Deprecated',
};

interface CapabilityTreeItem {
  node: CapabilityNode;
  tasks: TaskNode[];
  children: CapabilityTreeItem[];
  progress: { done: number; total: number };
}

async function getChildCapabilities(
  ctx: OperationContext,
  parentId: string,
): Promise<CapabilityNode[]> {
  const edges = await ctx.edges.getByNode(parentId);
  const outgoing = edges.filter(
    (e: Edge) => e.source_id === parentId && e.relation === 'decomposes_into',
  );
  const children: CapabilityNode[] = [];
  for (const edge of outgoing) {
    const node = await ctx.nodes.getById(edge.target_id);
    if (node && node.type === 'capability') {
      children.push(node as CapabilityNode);
    }
  }
  return children;
}

async function getChildTasks(
  ctx: OperationContext,
  capId: string,
): Promise<TaskNode[]> {
  const edges = await ctx.edges.getByNode(capId);
  const outgoing = edges.filter(
    (e: Edge) => e.source_id === capId && e.relation === 'decomposes_into',
  );
  const tasks: TaskNode[] = [];
  for (const edge of outgoing) {
    const node = await ctx.nodes.getById(edge.target_id);
    if (node && node.type === 'task') {
      tasks.push(node as TaskNode);
    }
  }
  return tasks;
}

async function buildCapabilityTree(
  ctx: OperationContext,
  cap: CapabilityNode,
  depth: number = 0,
): Promise<CapabilityTreeItem> {
  if (depth > 5) {
    return { node: cap, tasks: [], children: [], progress: { done: 0, total: 0 } };
  }

  const tasks = await getChildTasks(ctx, cap.id);
  const childCaps = await getChildCapabilities(ctx, cap.id);
  const children: CapabilityTreeItem[] = [];
  for (const child of childCaps) {
    children.push(await buildCapabilityTree(ctx, child, depth + 1));
  }

  const taskDone = tasks.filter(t => t.status === 'done').length;
  const taskTotal = tasks.length;
  const childProgress = children.reduce(
    (acc, c) => ({ done: acc.done + c.progress.done, total: acc.total + c.progress.total }),
    { done: 0, total: 0 },
  );

  return {
    node: cap,
    tasks,
    children,
    progress: {
      done: taskDone + childProgress.done,
      total: taskTotal + childProgress.total,
    },
  };
}

function formatProgress(done: number, total: number): string {
  if (total === 0) return '';
  const pct = Math.round((done / total) * 100);
  return `[${done}/${total} — ${pct}%]`;
}

function formatCapabilityItem(item: CapabilityTreeItem, depth: number): string {
  const indent = '  '.repeat(depth);
  const badge = MATURITY_BADGE[item.node.maturity] ?? item.node.maturity;
  const prog = formatProgress(item.progress.done, item.progress.total);
  const parts: string[] = [];

  parts.push(`${indent}- **${item.node.title}** ${badge} ${prog}`);

  if (item.node.scope) {
    parts.push(`${indent}  边界: ${item.node.scope}`);
  }

  if (item.node.acceptance_criteria.length > 0) {
    for (const ac of item.node.acceptance_criteria) {
      parts.push(`${indent}  - [ ] ${ac}`);
    }
  }

  for (const child of item.children) {
    parts.push(formatCapabilityItem(child, depth + 1));
  }

  return parts.join('\n');
}

function collectIds(item: CapabilityTreeItem, set: Set<string>): void {
  set.add(item.node.id);
  for (const t of item.tasks) set.add(t.id);
  for (const child of item.children) collectIds(child, set);
}

export const deliveryMapProjection: ProjectionTemplate = {
  type: 'delivery-map',
  label: 'Delivery Map (Capability Overview)',
  description: 'Generate a product delivery overview from Capability nodes, grouped by domain and maturity',

  async generate(
    ctx: OperationContext,
    config: ProjectionConfigEntry,
  ): Promise<GeneratedProjection> {
    const allCaps = (await ctx.nodes.getByType('capability')) as CapabilityNode[];

    // Find root capabilities (not a target of decomposes_into from another capability)
    const allEdges: Edge[] = [];
    for (const cap of allCaps) {
      const edges = await ctx.edges.getByNode(cap.id);
      allEdges.push(...edges);
    }
    const childIds = new Set(
      allEdges
        .filter(e => e.relation === 'decomposes_into')
        .map(e => e.target_id),
    );
    let roots = allCaps.filter(c => !childIds.has(c.id));

    // Apply filters
    if (config.filters?.status?.length) {
      roots = roots.filter(c => config.filters!.status!.includes(c.status));
    }
    if (config.filters?.tags?.length) {
      roots = roots.filter(c => config.filters!.tags!.some(t => c.tags.includes(t)));
    }
    if (config.filters?.domain) {
      roots = roots.filter(c => c.domain === config.filters!.domain);
    }

    // Build trees
    const trees: CapabilityTreeItem[] = [];
    for (const root of roots) {
      trees.push(await buildCapabilityTree(ctx, root));
    }

    // Group by domain
    const byDomain = new Map<string, CapabilityTreeItem[]>();
    for (const tree of trees) {
      const domain = tree.node.domain || '未分类';
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(tree);
    }

    // Sort within each domain by maturity (stable first)
    for (const items of byDomain.values()) {
      items.sort((a, b) =>
        (MATURITY_ORDER[b.node.maturity] ?? 0) - (MATURITY_ORDER[a.node.maturity] ?? 0),
      );
    }

    // Render
    const now = new Date().toISOString();
    const parts: string[] = [];
    parts.push('# 交付全貌 (Delivery Map)\n');
    parts.push(`> 生成时间: ${now}\n`);

    // Summary stats
    const totalCaps = allCaps.length;
    const stableCaps = allCaps.filter(c => c.maturity === 'stable').length;
    const betaCaps = allCaps.filter(c => c.maturity === 'beta').length;
    const alphaCaps = allCaps.filter(c => c.maturity === 'alpha').length;
    const plannedCaps = allCaps.filter(c => c.maturity === 'planned').length;
    parts.push('## 概览\n');
    parts.push(`| 成熟度 | 数量 |`);
    parts.push(`|--------|------|`);
    parts.push(`| ✅ Stable | ${stableCaps} |`);
    parts.push(`| ⚡ Beta | ${betaCaps} |`);
    parts.push(`| 🧪 Alpha | ${alphaCaps} |`);
    parts.push(`| 🔲 Planned | ${plannedCaps} |`);
    parts.push(`| **合计** | **${totalCaps}** |`);
    parts.push('');

    // Per-domain sections
    parts.push('## 能力清单\n');
    for (const [domain, items] of byDomain) {
      parts.push(`### ${domain}\n`);
      for (const item of items) {
        parts.push(formatCapabilityItem(item, 0));
      }
      parts.push('');
    }

    // Collect all source IDs
    const allIds = new Set<string>();
    for (const tree of trees) collectIds(tree, allIds);

    return {
      markdown: parts.join('\n'),
      metadata: {
        title: '交付全貌',
        generatedAt: now,
        sourceNodeCount: allIds.size,
        sourceNodeIds: Array.from(allIds),
      },
    };
  },
};
