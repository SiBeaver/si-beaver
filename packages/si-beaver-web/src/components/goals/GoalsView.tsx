import { useState } from 'react';
import { Typography, Drawer, Spin, Tag, Card, Empty } from 'antd';
import { FlagOutlined, LinkOutlined } from '@ant-design/icons';
import { RoadmapView } from '../roadmap/RoadmapView';
import { useNodeContext } from '../../hooks/useNodeContext';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import type { CognitiveNode, SemanticEdge } from '../../lib/types';

const RELATION_LABELS: Record<string, string> = {
  decomposes_into: '分解为',
  spawns: '衍生出',
  produces: '产出',
  informs: '告知',
  creates: '创建',
  mitigates: '缓解',
  addresses: '处理',
  blocks: '阻塞',
  relates_to: '关联',
  supersedes: '取代',
  evidenced_by: '证据来源',
  derived_from: '派生自',
};

// Causal chain order for Goal view
const CAUSAL_ORDER = ['spawns', 'produces', 'creates'];

interface Props {
  slug: string;
}

export function GoalsView({ slug }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: ctx, isLoading } = useNodeContext(slug, selectedId);

  const handleClose = () => setSelectedId(null);

  // Group neighbors by relation direction
  const grouped = ctx ? buildCausalGroups(ctx.node, ctx.edges, ctx.neighbors) : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>③ 目标</Typography.Title>
        <Tag color="blue" icon={<FlagOutlined />} style={{ margin: 0 }}>
          点击 Goal 查看因果链
        </Tag>
      </div>

      <RoadmapView slug={slug} onContextClick={(id) => setSelectedId(id)} />

      <Drawer
        title={ctx ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NodeTypeBadge type={ctx.node.type} />
            <Typography.Text strong ellipsis style={{ maxWidth: 260 }}>{ctx.node.title}</Typography.Text>
            <StatusBadge status={ctx.node.status} />
          </div>
        ) : '加载中...'}
        open={!!selectedId}
        onClose={handleClose}
        width={520}
        placement="right"
      >
        {isLoading && <Spin style={{ display: 'block', margin: '40px auto' }} />}
        {!isLoading && !ctx && <Empty description="无法加载节点信息" />}
        {!isLoading && ctx && grouped && (
          <div>
            {/* Node description */}
            {ctx.node.description && (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {ctx.node.description}
              </Typography.Paragraph>
            )}

            {/* Causal chain sections */}
            {grouped.map(({ label, nodes, relation }) => (
              <Card
                key={relation}
                size="small"
                title={
                  <span>
                    <LinkOutlined style={{ marginRight: 6 }} />
                    {label}
                  </span>
                }
                style={{ borderRadius: 8, marginBottom: 12 }}
              >
                {nodes.length === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>（无）</Typography.Text>
                ) : (
                  nodes.map(n => (
                    <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <NodeTypeBadge type={n.type} />
                        <Typography.Text ellipsis style={{ flex: 1, fontSize: 13 }}>{n.title}</Typography.Text>
                        <StatusBadge status={n.status} />
                      </div>
                    </div>
                  ))
                )}
              </Card>
            ))}

            {/* Other relations */}
            {grouped.length === 0 && (
              <Empty description="暂无因果链关联" />
            )}

            {/* Timestamps */}
            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                创建: <TimeAgo date={ctx.node.createdAt} />
                {' · '}更新: <TimeAgo date={ctx.node.updatedAt} />
              </Typography.Text>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function buildCausalGroups(
  node: CognitiveNode,
  edges: SemanticEdge[],
  neighbors: CognitiveNode[],
) {
  const neighborMap = new Map(neighbors.map(n => [n.id, n]));

  // Edges where this node is the source (outgoing causal chain)
  const outgoing = edges.filter(e => e.source_id === node.id);

  return CAUSAL_ORDER.map(relation => {
    const matching = outgoing.filter(e => e.relation === relation);
    const relatedNodes = matching
      .map(e => neighborMap.get(e.target_id))
      .filter(Boolean) as CognitiveNode[];
    return {
      label: `${node.title.split(' ')[0]} ${RELATION_LABELS[relation] ?? relation} →`,
      nodes: relatedNodes,
      relation,
    };
  }).filter(g => g.nodes.length > 0);
}
