import { Skeleton, Alert, Card, Tag, Typography, Statistic, List, theme } from 'antd';
import useSWR from 'swr';
import { fetchProjectState, fetchKnowledgeMap, fetchActivity } from '../../api/client';
import type { CognitiveNode, EventRecord } from '../../lib/types';

interface Props {
  slug: string;
}

export function ReviewerView({ slug }: Props) {
  const { token } = theme.useToken();

  const { data: state, isLoading: l1, error: e1 } = useSWR(
    `${slug}/rev/state`, () => fetchProjectState(slug), { refreshInterval: 30_000 },
  );
  const { data: knowledge, isLoading: l2, error: e2 } = useSWR(
    `${slug}/rev/knowledge`, () => fetchKnowledgeMap(slug), { refreshInterval: 60_000 },
  );
  const { data: activity, isLoading: l3, error: e3 } = useSWR(
    `${slug}/rev/activity`, () => fetchActivity(slug, 15), { refreshInterval: 15_000 },
  );

  if (l1 || l2 || l3) return <Skeleton active paragraph={{ rows: 8 }} />;
  const error = e1 || e2 || e3;
  if (error) return <Alert type="error" message="加载失败" description={error.message} />;

  const stats = state?.statistics;
  const domains = Object.entries(knowledge?.byDomain ?? {});
  const decisions = state?.recentDecisions ?? [];
  const events = activity?.events ?? [];

  return (
    <div style={{ maxWidth: 900 }}>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          <Card size="small" styles={{ body: { padding: '12px' } }}>
            <Statistic title="目标" value={stats.totalGoals} suffix={`/ ${stats.achievedGoals} 达成`} valueStyle={{ fontSize: 20 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: '12px' } }}>
            <Statistic title="探索" value={stats.activeExplorations} valueStyle={{ fontSize: 20 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: '12px' } }}>
            <Statistic title="风险" value={stats.openRisks} valueStyle={{ fontSize: 20, color: stats.openRisks > 0 ? token.colorWarning : undefined }} />
          </Card>
          <Card size="small" styles={{ body: { padding: '12px' } }}>
            <Statistic title="技术债" value={stats.techDebtItems} valueStyle={{ fontSize: 20 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: '12px' } }}>
            <Statistic title="需求" value={stats.openRequirements} suffix={`/ ${stats.totalRequirements}`} valueStyle={{ fontSize: 20 }} />
          </Card>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="知识分布" size="small" styles={{ body: { padding: '12px 16px' } }}>
          {domains.length === 0 ? (
            <Typography.Text type="secondary">暂无知识记录</Typography.Text>
          ) : (
            domains.slice(0, 8).map(([domain, items]) => (
              <div key={domain} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color="geekblue" style={{ margin: 0 }}>{domain}</Tag>
                <Typography.Text>{(items as CognitiveNode[]).length} 条</Typography.Text>
              </div>
            ))
          )}
        </Card>

        <Card title="近期决策" size="small" styles={{ body: { padding: '12px 16px' } }}>
          {decisions.length === 0 ? (
            <Typography.Text type="secondary">暂无决策</Typography.Text>
          ) : (
            decisions.slice(0, 6).map((d: CognitiveNode) => (
              <div key={d.id} style={{ marginBottom: 8 }}>
                <Typography.Text ellipsis>{d.title}</Typography.Text>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {d.rationale ? d.rationale.slice(0, 60) + '...' : d.status}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card title="最近活动" size="small" styles={{ body: { padding: '12px 16px' } }}>
        {events.length === 0 ? (
          <Typography.Text type="secondary">暂无动态</Typography.Text>
        ) : (
          <List
            size="small"
            dataSource={events.slice(0, 12)}
            renderItem={(ev: EventRecord) => (
              <List.Item style={{ padding: '6px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <Tag style={{ margin: 0 }}>{ev.operation}</Tag>
                  <Typography.Text ellipsis style={{ flex: 1 }}>
                    {(ev.payload as any)?.title ?? ev.nodeId}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                    {new Date(ev.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Typography.Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
