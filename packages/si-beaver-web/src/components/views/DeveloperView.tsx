import { Skeleton, Alert, Card, Tag, Progress, Typography, List, theme } from 'antd';
import useSWR from 'swr';
import { fetchGoalProgress, fetchActivity, fetchStaleItems } from '../../api/client';
import type { GoalProgressItem } from '../../api/client';
import { STATUS_LABELS } from '../../lib/constants';
import type { EventRecord } from '../../lib/types';

interface Props {
  slug: string;
}

export function DeveloperView({ slug }: Props) {
  const { token } = theme.useToken();

  const { data: progress, isLoading: l1, error: e1 } = useSWR(
    `${slug}/dev/progress`, () => fetchGoalProgress(slug), { refreshInterval: 30_000 },
  );
  const { data: activity, isLoading: l3, error: e3 } = useSWR(
    `${slug}/dev/activity`, () => fetchActivity(slug, 10), { refreshInterval: 15_000 },
  );
  const { data: stale, isLoading: l4, error: e4 } = useSWR(
    `${slug}/dev/stale`, () => fetchStaleItems(slug, 5), { refreshInterval: 60_000 },
  );

  if (l1 || l3 || l4) return <Skeleton active paragraph={{ rows: 8 }} />;
  const error = e1 || e3 || e4;
  if (error) return <Alert type="error" message="加载失败" description={error.message} />;

  const goals = progress?.goals ?? [];
  const events = activity?.events ?? [];
  const staleItems = stale?.staleItems ?? [];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="目标进度" size="small" styles={{ body: { padding: '12px 16px' } }}>
          {goals.length === 0 ? (
            <Typography.Text type="secondary">暂无活跃目标</Typography.Text>
          ) : (
            goals.slice(0, 8).map((item: GoalProgressItem) => (
              <div key={item.goal.id} style={{ marginBottom: 10 }}>
                <Typography.Text ellipsis>{item.goal.title}</Typography.Text>
                <Progress percent={item.percentage} size="small" strokeColor={token.colorPrimary} style={{ marginTop: 2 }} />
              </div>
            ))
          )}
        </Card>

        <Card title="停滞项" size="small" styles={{ body: { padding: '12px 16px' } }}>
          {staleItems.length === 0 ? (
            <Typography.Text type="secondary">无停滞项</Typography.Text>
          ) : (
            staleItems.slice(0, 6).map(item => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag style={{ margin: 0 }}>{item.type}</Tag>
                  <Typography.Text ellipsis>{item.title}</Typography.Text>
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {STATUS_LABELS[item.status] ?? item.status} · 更新于 {item.updatedAt?.slice(0, 10)}
                </Typography.Text>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card title="最近动态" size="small" styles={{ body: { padding: '12px 16px' } }}>
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
