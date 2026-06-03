import { Skeleton, Alert, Card, Tag, Progress, Typography, Space, theme, Timeline } from 'antd';
import useSWR from 'swr';
import { fetchRoadmap, fetchHelmSignals, fetchBlockers } from '../../api/client';
import { PRIORITY_COLORS, HORIZON_LABELS } from '../../lib/constants';
import type { RoadmapItem } from '../../lib/types';

interface Props {
  slug: string;
}

export function ArchitectView({ slug }: Props) {
  const { token } = theme.useToken();

  const { data: roadmap, isLoading: l1, error: e1 } = useSWR(
    `${slug}/arch/roadmap`, () => fetchRoadmap(slug, false, 2), { refreshInterval: 30_000 },
  );
  const { data: helm, isLoading: l2, error: e2 } = useSWR(
    `${slug}/arch/helm`, () => fetchHelmSignals(slug), { refreshInterval: 15_000 },
  );
  const { data: blockers, isLoading: l3, error: e3 } = useSWR(
    `${slug}/arch/blockers`, () => fetchBlockers(slug), { refreshInterval: 30_000 },
  );

  if (l1 || l2 || l3) return <Skeleton active paragraph={{ rows: 8 }} />;
  const error = e1 || e2 || e3;
  if (error) return <Alert type="error" message="加载失败" description={error.message} />;

  const goals = roadmap?.roadmap ?? [];
  const signals = helm?.signals ?? [];
  const blockerList = blockers?.blockers ?? [];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="目标结构" size="small" styles={{ body: { padding: '12px 16px' } }}>
          {goals.length === 0 ? (
            <Typography.Text type="secondary">暂无活跃目标</Typography.Text>
          ) : (
            goals.slice(0, 8).map((item: RoadmapItem) => {
              const pct = item.progress.total > 0 ? Math.round(item.progress.done / item.progress.total * 100) : 0;
              return (
                <div key={item.node.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={PRIORITY_COLORS[item.node.priority ?? 'medium']} style={{ margin: 0 }}>
                      {HORIZON_LABELS[item.node.horizon ?? ''] ?? item.node.horizon}
                    </Tag>
                    <Typography.Text ellipsis style={{ flex: 1 }}>{item.node.title}</Typography.Text>
                  </div>
                  <Progress percent={pct} size="small" strokeColor={token.colorPrimary} style={{ marginTop: 4 }} />
                </div>
              );
            })
          )}
        </Card>

        <Card title="阻塞项" size="small" styles={{ body: { padding: '12px 16px' } }}>
          {blockerList.length === 0 ? (
            <Typography.Text type="secondary">无阻塞</Typography.Text>
          ) : (
            blockerList.slice(0, 6).map(b => (
              <div key={b.blocker.id} style={{ marginBottom: 8 }}>
                <Typography.Text strong>{b.blocker.title}</Typography.Text>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  阻塞: {b.blocks.map(n => n.title).join(', ')}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card title="需要决策的信号" size="small" styles={{ body: { padding: '12px 16px' } }}>
        {signals.length === 0 ? (
          <Typography.Text type="secondary">一切平稳</Typography.Text>
        ) : (
          <Timeline
            items={signals.slice(0, 10).map(s => ({
              color: s.urgency === 'critical' ? 'red' : s.urgency === 'high' ? 'orange' : 'blue',
              children: (
                <div>
                  <Space size={4}>
                    <Tag color={s.urgency === 'critical' ? 'red' : s.urgency === 'high' ? 'orange' : 'default'}>{s.urgency}</Tag>
                    <Typography.Text strong>{s.title}</Typography.Text>
                  </Space>
                  <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>{s.summary}</div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
