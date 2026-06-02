import { useState } from 'react';
import { Typography, Card, Tag, Progress, Skeleton, Alert, Space, Empty } from 'antd';
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  StopOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import useSWR from 'swr';
import { fetchCapabilityTree } from '../../api/client';
import type { CapabilityTreeNode } from '../../api/client';

interface Props {
  slug: string;
}

const MATURITY_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string; order: number }> = {
  stable: { color: 'green', icon: <CheckCircleOutlined />, label: 'Stable', order: 4 },
  beta: { color: 'blue', icon: <ThunderboltOutlined />, label: 'Beta', order: 3 },
  alpha: { color: 'orange', icon: <ExperimentOutlined />, label: 'Alpha', order: 2 },
  planned: { color: 'default', icon: <ClockCircleOutlined />, label: 'Planned', order: 1 },
  deprecated: { color: 'red', icon: <StopOutlined />, label: 'Deprecated', order: 0 },
};

function MaturityTag({ maturity }: { maturity: string }) {
  const config = MATURITY_CONFIG[maturity] ?? MATURITY_CONFIG.planned;
  return (
    <Tag color={config.color} icon={config.icon}>
      {config.label}
    </Tag>
  );
}

function ProgressDisplay({ progress }: { progress: { done: number; total: number } }) {
  if (progress.total === 0) return null;
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
      {progress.done}/{progress.total} ({pct}%)
    </span>
  );
}

function SummaryBar({ tree }: { tree: CapabilityTreeNode[] }) {
  function countAll(nodes: CapabilityTreeNode[]): Record<string, number> {
    const counts: Record<string, number> = { stable: 0, beta: 0, alpha: 0, planned: 0, deprecated: 0 };
    for (const n of nodes) {
      const m = n.maturity ?? 'planned';
      if (m in counts) counts[m]++;
      const childCounts = countAll(n.children);
      for (const k of Object.keys(counts)) counts[k] += childCounts[k] ?? 0;
    }
    return counts;
  }

  const counts = countAll(tree);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const delivered = counts.stable + counts.beta;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <Card style={{ marginBottom: 24 }} styles={{ body: { padding: '16px 24px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <Typography.Text type="secondary">交付进度</Typography.Text>
          <Progress
            percent={pct}
            size="small"
            style={{ width: 200, marginTop: 4 }}
            strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
          />
        </div>
        <Space size={[8, 8]} wrap>
          <Tag color="green">Stable: {counts.stable}</Tag>
          <Tag color="blue">Beta: {counts.beta}</Tag>
          <Tag color="orange">Alpha: {counts.alpha}</Tag>
          <Tag>Planned: {counts.planned}</Tag>
          {counts.deprecated > 0 && <Tag color="red">Deprecated: {counts.deprecated}</Tag>}
          <Tag style={{ fontWeight: 600 }}>合计: {total}</Tag>
        </Space>
      </div>
    </Card>
  );
}

function ChildCapability({ cap, depth }: { cap: CapabilityTreeNode; depth: number }) {
  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text style={{ fontSize: 13 }}>{cap.title}</Typography.Text>
        <MaturityTag maturity={cap.maturity} />
        <ProgressDisplay progress={cap.progress} />
      </div>
      {cap.scope && (
        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 0 }}>
          {cap.scope}
        </Typography.Text>
      )}
      {cap.children.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {cap.children.map(child => (
            <ChildCapability key={child.id} cap={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SystemCapabilityCard({ cap }: { cap: CapabilityTreeNode }) {
  const [expanded, setExpanded] = useState(false);
  const childMaturitySummary = cap.children.reduce((acc, c) => {
    acc[c.maturity] = (acc[c.maturity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card
      size="small"
      style={{ marginBottom: 12, cursor: cap.children.length > 0 ? 'pointer' : 'default' }}
      styles={{ body: { padding: '16px 20px' } }}
      onClick={() => cap.children.length > 0 && setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {cap.children.length > 0 && (
              expanded
                ? <DownOutlined style={{ fontSize: 10, color: '#999' }} />
                : <RightOutlined style={{ fontSize: 10, color: '#999' }} />
            )}
            <Typography.Text strong style={{ fontSize: 15 }}>{cap.title}</Typography.Text>
            <MaturityTag maturity={cap.maturity} />
            <ProgressDisplay progress={cap.progress} />
          </div>
          {cap.description && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {cap.description}
            </Typography.Text>
          )}
          {!expanded && cap.children.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <Space size={[4, 4]} wrap>
                {Object.entries(childMaturitySummary)
                  .sort(([a], [b]) => (MATURITY_CONFIG[b]?.order ?? 0) - (MATURITY_CONFIG[a]?.order ?? 0))
                  .map(([m, count]) => (
                    <Tag key={m} color={MATURITY_CONFIG[m]?.color ?? 'default'} style={{ fontSize: 11 }}>
                      {MATURITY_CONFIG[m]?.label ?? m}: {count}
                    </Tag>
                  ))}
              </Space>
            </div>
          )}
        </div>
        {cap.tags.length > 0 && (
          <Space size={[4, 4]} wrap>
            {cap.tags.map(t => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
          </Space>
        )}
      </div>
      {expanded && cap.children.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          {cap.children.map(child => (
            <ChildCapability key={child.id} cap={child} depth={0} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function CapabilitiesView({ slug }: Props) {
  const { data, error, isLoading } = useSWR(
    `${slug}/capabilities/tree`,
    () => fetchCapabilityTree(slug),
    { refreshInterval: 30_000 },
  );

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;

  const tree = data?.tree ?? [];
  if (tree.length === 0) {
    return (
      <Empty
        description="尚未定义任何能力节点"
        style={{ marginTop: 64 }}
      />
    );
  }

  // Sort roots: stable first, then by maturity order desc
  const sorted = [...tree].sort((a, b) => {
    const oa = MATURITY_CONFIG[a.maturity]?.order ?? 0;
    const ob = MATURITY_CONFIG[b.maturity]?.order ?? 0;
    return ob - oa;
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <SummaryBar tree={tree} />
      {sorted.map(cap => (
        <SystemCapabilityCard key={cap.id} cap={cap} />
      ))}
    </div>
  );
}
