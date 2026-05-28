import { Typography, Card, Tag, Skeleton, Alert, Empty } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import { useProjectState } from '../../hooks/useProjectState';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';

interface Props {
  slug: string;
}

export function DesignView({ slug }: Props) {
  const { data: state, error, isLoading } = useProjectState(slug);

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;
  if (!state) return <Empty description="暂无数据" />;

  const accepted = (state.recentDecisions ?? []).filter(d => d.status === 'accepted');

  // group by first tag, fallback to "未分类"
  const groups = new Map<string, typeof accepted>();
  for (const d of accepted) {
    const key = d.tags?.[0] || '未分类';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  // sort groups alphabetically, "未分类" last
  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === '未分类') return 1;
    if (b === '未分类') return -1;
    return a.localeCompare(b);
  });

  if (accepted.length === 0) {
    return (
      <div style={{ maxWidth: 900 }}>
        <Typography.Title level={4}>② 设计</Typography.Title>
        <Empty description="暂无已接受的决策。决策被接受后将按标签自动聚合为架构快照。" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>② 设计</Typography.Title>
        <Tag color="processing" icon={<BuildOutlined />} style={{ margin: 0 }}>
          由 {accepted.length} 个 accepted 决策自动推导
        </Tag>
      </div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        架构快照由已接受决策自动聚合，是 AI 推理的收敛锚点。不供人审批，仅供参考。
      </Typography.Paragraph>

      {sorted.map(([tag, decisions]) => (
        <Card
          key={tag}
          title={
            <span>
              <Tag color="blue" style={{ marginRight: 8 }}>{tag}</Tag>
              <Typography.Text type="secondary">{decisions.length} 个决策</Typography.Text>
            </span>
          }
          style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: 0 } }}
        >
          {decisions.map(d => (
            <div
              key={d.id}
              style={{
                padding: '14px 24px',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Typography.Text strong style={{ flex: 1 }}>{d.title}</Typography.Text>
                <StatusBadge status={d.status} />
                <TimeAgo date={d.updatedAt} />
              </div>
              {d.rationale && (
                <Typography.Paragraph
                  type="secondary"
                  ellipsis={{ rows: 3 }}
                  style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}
                >
                  {d.rationale}
                </Typography.Paragraph>
              )}
              {d.tags.length > 1 && (
                <div style={{ marginTop: 6 }}>
                  {d.tags.slice(1).map(t => (
                    <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
