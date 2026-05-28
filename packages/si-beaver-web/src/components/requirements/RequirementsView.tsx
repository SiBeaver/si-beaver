import { useState } from 'react';
import { Card, Tag, Typography, Space, Drawer, Alert, List, Skeleton, Row, Col, theme } from 'antd';
import useSWR from 'swr';
import { fetchProjectState, fetchNodeContext } from '../../api/client';
import type { CognitiveNode } from '../../lib/types';
import { STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';

const { Text } = Typography;

const STATUS_GROUPS = [
  { key: 'in_execution', label: '执行中' },
  { key: 'revision_needed', label: '需修订' },
  { key: 'accepted', label: '已接受' },
  { key: 'proposed', label: '待精炼' },
  { key: 'satisfied', label: '已满足' },
  { key: 'deprecated', label: '已弃用' },
];

export function RequirementsView({ slug }: { slug: string }) {
  const { data, error, isLoading } = useSWR(`requirements-${slug}`, () => fetchProjectState(slug), { refreshInterval: 30000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { token } = theme.useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} />;

  const requirements = data?.requirements ?? [];
  if (requirements.length === 0) return <EmptyState title="暂无需求" description="通过 MCP 工具 define_requirement 创建需求" />;

  const grouped = STATUS_GROUPS.map(g => ({
    ...g,
    items: requirements.filter(r => r.status === g.key),
  })).filter(g => g.items.length > 0);

  return (
    <div>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <Space size={12}>
            <Text type="secondary">
              {requirements.length} 个需求 / {data?.openRequirements?.length ?? 0} 个活跃
            </Text>
          </Space>
        </Col>
      </Row>

      {grouped.map(group => (
        <div key={group.key} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={STATUS_COLORS[group.key]}>{group.label}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>{group.items.length}</Text>
          </div>
          <Row gutter={[12, 12]}>
            {group.items.map(req => (
              <Col key={req.id} xs={24} md={12} lg={8}>
                <RequirementCard node={req} onClick={() => setSelectedId(req.id)} token={token} />
              </Col>
            ))}
          </Row>
        </div>
      ))}

      <RequirementDrawer slug={slug} nodeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function RequirementCard({ node, onClick, token }: { node: CognitiveNode; onClick: () => void; token: any }) {
  const acCount = node.acceptanceCriteria?.length ?? 0;

  return (
    <Card
      size="small"
      hoverable
      onClick={onClick}
      style={{ borderLeft: `3px solid ${token.colorPrimary}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 13 }}>{node.title}</Text>
        <Tag color={PRIORITY_COLORS[node.priority ?? 'medium']} style={{ fontSize: 11, margin: 0 }}>
          {PRIORITY_LABELS[node.priority ?? 'medium']}
        </Tag>
      </div>
      {node.description && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }} ellipsis>
          {node.description}
        </Text>
      )}
      <Space size={8} style={{ marginTop: 4 }}>
        {node.source && <Tag style={{ fontSize: 11 }}>{node.source}</Tag>}
        {acCount > 0 && <Text type="secondary" style={{ fontSize: 11 }}>{acCount} 验收标准</Text>}
        <TimeAgo date={node.updatedAt} />
      </Space>
    </Card>
  );
}

function RequirementDrawer({ slug, nodeId, onClose }: { slug: string; nodeId: string | null; onClose: () => void }) {
  const { data, isLoading } = useSWR(
    nodeId ? `node-ctx-${slug}-${nodeId}` : null,
    () => fetchNodeContext(slug, nodeId!),
    { refreshInterval: 30000 },
  );

  const node = data?.node;
  const edges = data?.edges ?? [];
  const neighbors = data?.neighbors ?? [];

  const isRevisionNeeded = node?.status === 'revision_needed';
  const contradictEdges = edges.filter(e => e.relation === 'contradicts' && e.target_id === nodeId);
  const fulfillEdges = edges.filter(e => e.relation === 'fulfills' && e.target_id === nodeId);
  const informsEdges = edges.filter(e => e.relation === 'informs' && e.source_id === nodeId);

  const contradictNodes = contradictEdges.map(e => neighbors.find(n => n.id === e.source_id)).filter(Boolean) as CognitiveNode[];
  const fulfillNodes = fulfillEdges.map(e => neighbors.find(n => n.id === e.source_id)).filter(Boolean) as CognitiveNode[];
  const informsNodes = informsEdges.map(e => neighbors.find(n => n.id === e.target_id)).filter(Boolean) as CognitiveNode[];

  return (
    <Drawer
      open={!!nodeId}
      onClose={onClose}
      width={520}
      placement="right"
      title={node?.title ?? '需求详情'}
    >
      {isLoading && <Skeleton active />}
      {node && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {isRevisionNeeded && (
            <Alert
              type="warning"
              showIcon
              message="此需求需要修订"
              description={
                contradictNodes.length > 0
                  ? `${contradictNodes.length} 条知识与验收标准冲突`
                  : '执行中发现验收标准不可达'
              }
            />
          )}

          <div>
            <Space size={8}>
              <StatusBadge status={node.status} />
              <Tag color={PRIORITY_COLORS[node.priority ?? 'medium']}>
                {PRIORITY_LABELS[node.priority ?? 'medium']}
              </Tag>
              {node.source && <Tag>{node.source}</Tag>}
            </Space>
          </div>

          {node.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>描述</Text>
              <div style={{ marginTop: 4 }}>{node.description}</div>
            </div>
          )}

          {(node.acceptanceCriteria?.length ?? 0) > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>验收标准</Text>
              <List
                size="small"
                dataSource={node.acceptanceCriteria}
                renderItem={(item: string) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Text style={{ fontSize: 13 }}>{item}</Text>
                  </List.Item>
                )}
                style={{ marginTop: 4 }}
              />
            </div>
          )}

          {contradictNodes.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>自愈信号</Text>
              {contradictNodes.map(k => (
                <Alert
                  key={k.id}
                  type="warning"
                  style={{ marginTop: 4 }}
                  message={`Knowledge: ${k.title}`}
                  description={k.description}
                  showIcon
                />
              ))}
            </div>
          )}

          {fulfillNodes.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>执行链 (fulfills)</Text>
              <List
                size="small"
                dataSource={fulfillNodes}
                renderItem={(n: CognitiveNode) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space size={4}>
                      <Tag style={{ fontSize: 11 }}>{n.type}</Tag>
                      <Text style={{ fontSize: 13 }}>{n.title}</Text>
                      <StatusBadge status={n.status} />
                    </Space>
                  </List.Item>
                )}
                style={{ marginTop: 4 }}
              />
            </div>
          )}

          {informsNodes.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>告知 (informs)</Text>
              <List
                size="small"
                dataSource={informsNodes}
                renderItem={(n: CognitiveNode) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space size={4}>
                      <Tag style={{ fontSize: 11 }}>{n.type}</Tag>
                      <Text style={{ fontSize: 13 }}>{n.title}</Text>
                      <StatusBadge status={n.status} />
                    </Space>
                  </List.Item>
                )}
                style={{ marginTop: 4 }}
              />
            </div>
          )}

          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              创建于 {node.createdAt?.slice(0, 10)} | 更新于 {node.updatedAt?.slice(0, 10)} | ID: {node.id.slice(0, 8)}
            </Text>
          </div>
        </Space>
      )}
    </Drawer>
  );
}
