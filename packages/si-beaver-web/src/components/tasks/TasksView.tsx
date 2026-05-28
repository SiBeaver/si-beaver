import { useState } from 'react';
import { Typography, Card, Tag, Skeleton, Alert, Empty, Row, Col, Drawer, Spin } from 'antd';
import { UnorderedListOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons';
import { useProjectState } from '../../hooks/useProjectState';
import { useBlockers } from '../../hooks/useBlockers';
import { useNodeContext } from '../../hooks/useNodeContext';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants';
import type { CognitiveNode } from '../../lib/types';

const STATUS_COLUMNS = ['proposed', 'ready', 'in_progress', 'done'] as const;
const STATUS_COLUMN_TITLES: Record<string, string> = {
  proposed: '待定',
  ready: '就绪',
  in_progress: '进行中',
  done: '已完成',
};

interface Props {
  slug: string;
}

export function TasksView({ slug }: Props) {
  const { data: state, error, isLoading } = useProjectState(slug);
  const { data: blockersData } = useBlockers(slug);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: ctx, isLoading: ctxLoading } = useNodeContext(slug, selectedId);

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;
  if (!state) return <EmptyState title="暂无数据" description="启动 API 服务后数据将在此显示。" />;

  const tasks = state.pendingTasks ?? [];
  const blockers = blockersData?.blockers ?? [];

  // Group tasks by status
  const columns = new Map<string, CognitiveNode[]>();
  for (const col of STATUS_COLUMNS) columns.set(col, []);
  for (const t of tasks) {
    const col = columns.get(t.status);
    if (col) col.push(t);
    else (columns.get('proposed') ?? []).push(t);
  }

  // Sort each column by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  for (const [, list] of columns) {
    list.sort((a, b) => (priorityOrder[a.priority ?? 'low'] ?? 3) - (priorityOrder[b.priority ?? 'low'] ?? 3));
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>④ 任务</Typography.Title>
        <Tag color="green" icon={<UnorderedListOutlined />} style={{ margin: 0 }}>
          {tasks.length} 个任务
        </Tag>
      </div>

      {/* Blockers section */}
      {blockers.length > 0 && (
        <Card
          size="small"
          title={
            <span>
              <WarningOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
              阻塞项
            </span>
          }
          style={{ borderRadius: 12, marginBottom: 20 }}
          styles={{ body: { padding: '8px 16px' } }}
        >
          {blockers.map(b => (
            <div key={b.blocker.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NodeTypeBadge type={b.blocker.type} />
                <Typography.Text ellipsis style={{ flex: 1 }}>{b.blocker.title}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  阻塞 {b.blocks.length} 项
                </Typography.Text>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Kanban columns */}
      {tasks.length === 0 ? (
        <Empty description="暂无任务。通过 MCP 创建任务后将在此显示。" />
      ) : (
        <Row gutter={[12, 12]}>
          {STATUS_COLUMNS.map(col => {
            const list = columns.get(col) ?? [];
            return (
              <Col key={col} xs={24} sm={12} md={6}>
                <Card
                  size="small"
                  title={
                    <span>
                      <StatusBadge status={col} />
                      <span style={{ marginLeft: 6, fontSize: 13 }}>{STATUS_COLUMN_TITLES[col]}</span>
                      <Tag style={{ marginLeft: 8 }}>{list.length}</Tag>
                    </span>
                  }
                  style={{ borderRadius: 10, height: '100%', minHeight: 120 }}
                  styles={{ body: { padding: '4px 8px' } }}
                >
                  {list.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        padding: '8px 10px',
                        margin: '4px 0',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: '1px solid #f0f0f0',
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <NodeTypeBadge type={t.type} />
                        {t.priority && (
                          <Tag color={PRIORITY_COLORS[t.priority]} bordered={false} style={{ fontSize: 10, lineHeight: '16px' }}>
                            {PRIORITY_LABELS[t.priority]}
                          </Tag>
                        )}
                      </div>
                      <Typography.Text ellipsis style={{ fontSize: 13 }}>{t.title}</Typography.Text>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: 12 }}>
                      暂无
                    </Typography.Text>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Task detail drawer */}
      <Drawer
        title={ctx ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NodeTypeBadge type={ctx.node.type} />
            <Typography.Text ellipsis style={{ maxWidth: 260 }}>{ctx.node.title}</Typography.Text>
            <StatusBadge status={ctx.node.status} />
          </div>
        ) : '加载中...'}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        width={480}
        placement="right"
      >
        {ctxLoading && <Spin style={{ display: 'block', margin: '40px auto' }} />}
        {!ctxLoading && ctx && (
          <div>
            {ctx.node.description && (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {ctx.node.description}
              </Typography.Paragraph>
            )}
            {ctx.node.acceptanceCriteria && ctx.node.acceptanceCriteria.length > 0 && (
              <Card size="small" title="验收标准" style={{ borderRadius: 8, marginBottom: 12 }}>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {ctx.node.acceptanceCriteria.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Card>
            )}
            {/* Related nodes via edges */}
            {ctx.edges.length > 0 && (
              <Card size="small" title={<span><LinkOutlined style={{ marginRight: 6 }} />关联节点</span>} style={{ borderRadius: 8, marginBottom: 12 }}>
                {ctx.neighbors.map(n => (
                  <div key={n.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NodeTypeBadge type={n.type} />
                    <Typography.Text ellipsis style={{ flex: 1, fontSize: 13 }}>{n.title}</Typography.Text>
                    <StatusBadge status={n.status} />
                  </div>
                ))}
              </Card>
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              创建: <TimeAgo date={ctx.node.createdAt} />
              {' · '}更新: <TimeAgo date={ctx.node.updatedAt} />
            </Typography.Text>
          </div>
        )}
      </Drawer>
    </div>
  );
}
