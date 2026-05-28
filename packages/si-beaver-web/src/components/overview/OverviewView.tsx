import { Row, Col, Card, Statistic, Typography, Skeleton, Alert, theme, List, Tag } from 'antd';
import {
  AimOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  WarningOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useProjectState } from '../../hooks/useProjectState';
import { useGoalProgress } from '../../hooks/useGoalProgress';
import { useBlockers } from '../../hooks/useBlockers';
import { useActivity } from '../../hooks/useActivity';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { StatusBadge } from '../shared/StatusBadge';
import { ProgressBar } from '../shared/ProgressBar';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants';
import type { CognitiveNode } from '../../lib/types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'goal.defined': '定义目标',
  'goal.decomposed': '分解目标',
  'goal.status_changed': '目标状态变更',
  'task.created': '创建任务',
  'task.status_changed': '任务状态变更',
  'decision.recorded': '记录决策',
  'decision.superseded': '取代决策',
  'exploration.started': '开始探索',
  'exploration.finding_recorded': '记录发现',
  'exploration.concluded': '探索结论',
  'exploration.abandoned': '放弃探索',
  'risk.identified': '识别风险',
  'risk.updated': '更新风险',
  'tech_debt.registered': '注册技术债',
  'knowledge.recorded': '记录知识',
  'knowledge.invalidated': '知识失效',
  'graph.edge_created': '建立关联',
};

export function OverviewView({ slug }: { slug: string }) {
  const { data: state, error, isLoading } = useProjectState(slug);
  const { data: progress } = useGoalProgress(slug);
  const { data: blockers } = useBlockers(slug);
  const { data: activity } = useActivity(slug, 10);
  const { token } = theme.useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;
  if (!state) return <EmptyState title="暂无数据" description="启动 API 服务后数据将在此显示。" />;

  const { statistics, recentDecisions } = state;

  const statCards = [
    { title: '活跃目标', value: statistics.totalGoals - statistics.achievedGoals, icon: <AimOutlined />, color: token.colorPrimary },
    { title: '已达成', value: statistics.achievedGoals, icon: <CheckCircleOutlined />, color: token.colorSuccess },
    { title: '待办任务', value: statistics.pendingTasks, icon: <UnorderedListOutlined />, color: token.colorWarning },
    { title: '未解决风险', value: statistics.openRisks, icon: <WarningOutlined />, color: token.colorError },
    { title: '知识条目', value: statistics.techDebtItems, icon: <BookOutlined />, color: '#722ed1' },
  ];

  const activeBlockers = blockers?.blockers ?? [];
  const goals = progress?.goals ?? [];
  const events = activity?.events ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Stats row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map(s => (
          <Col key={s.title} xs={12} sm={8} md={4}>
            <Card style={{ borderRadius: 12, height: '100%' }} styles={{ body: { padding: '20px 16px' } }}>
              <Statistic
                title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                value={s.value}
                prefix={<span style={{ color: s.color }}>{s.icon}</span>}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Two-column layout */}
      <Row gutter={[24, 24]}>
        {/* Left column: goal progress + blockers */}
        <Col xs={24} lg={14}>
          <Typography.Title level={5} style={{ marginBottom: 12 }}>目标进度</Typography.Title>
          {goals.length === 0 ? (
            <Card style={{ borderRadius: 12 }}><EmptyState title="暂无目标" description="通过 MCP 创建目标后将在此显示进度。" /></Card>
          ) : (
            <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
              <List
                dataSource={goals}
                renderItem={(item) => (
                  <List.Item style={{ padding: '14px 20px' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Typography.Text strong ellipsis style={{ flex: 1 }}>{item.goal.title}</Typography.Text>
                        {item.goal.priority && (
                          <Tag color={PRIORITY_COLORS[item.goal.priority]}>{PRIORITY_LABELS[item.goal.priority]}</Tag>
                        )}
                        <StatusBadge status={item.goal.status} />
                      </div>
                      <ProgressBar done={item.done} total={item.total} />
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* Blockers - only show if there are any */}
          {activeBlockers.length > 0 && (
            <>
              <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
                <WarningOutlined style={{ color: token.colorError, marginRight: 6 }} />
                阻塞项
              </Typography.Title>
              <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                <List
                  dataSource={activeBlockers}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <NodeTypeBadge type={item.blocker.type} />
                        <Typography.Text ellipsis style={{ flex: 1 }}>{item.blocker.title}</Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          阻塞 {item.blocks.length} 项
                        </Typography.Text>
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            </>
          )}
        </Col>

        {/* Right column: activity + recent decisions */}
        <Col xs={24} lg={10}>
          <Typography.Title level={5} style={{ marginBottom: 12 }}>最近活动</Typography.Title>
          {events.length === 0 ? (
            <Card style={{ borderRadius: 12 }}><EmptyState title="暂无活动" description="项目活动将在此展示。" /></Card>
          ) : (
            <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
              <List
                dataSource={events}
                size="small"
                renderItem={(ev) => (
                  <List.Item style={{ padding: '10px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      {ev.nodeType && <NodeTypeBadge type={ev.nodeType as CognitiveNode['type']} />}
                      <Typography.Text ellipsis style={{ flex: 1, fontSize: 13 }}>
                        {EVENT_TYPE_LABELS[ev.eventType] ?? ev.operation}
                        {ev.payload?.title ? ` — ${ev.payload.title}` : ''}
                      </Typography.Text>
                      <TimeAgo date={ev.timestamp} />
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* Recent decisions */}
          {recentDecisions.length > 0 && (
            <>
              <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>最近决策</Typography.Title>
              <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                <List
                  dataSource={recentDecisions.slice(0, 5)}
                  renderItem={(d) => (
                    <List.Item style={{ padding: '12px 20px' }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <NodeTypeBadge type="decision" />
                          <Typography.Text strong ellipsis style={{ flex: 1 }}>{d.title}</Typography.Text>
                          <TimeAgo date={d.updatedAt} />
                        </div>
                        {d.rationale && (
                          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 12, paddingLeft: 4 }}>
                            {d.rationale}
                          </Typography.Paragraph>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            </>
          )}
        </Col>
      </Row>
    </div>
  );
}
