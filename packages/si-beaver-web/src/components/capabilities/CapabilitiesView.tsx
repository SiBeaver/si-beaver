import { Typography, Card, Tag, Progress, Skeleton, Alert, Space, Empty } from 'antd';
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import useSWR from 'swr';
import { fetchCapabilities } from '../../api/client';
import type { CognitiveNode } from '../../lib/types';

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

function groupByDomain(caps: CognitiveNode[]): Map<string, CognitiveNode[]> {
  const map = new Map<string, CognitiveNode[]>();
  for (const cap of caps) {
    const domain = cap.domain || '未分类';
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain)!.push(cap);
  }
  for (const items of map.values()) {
    items.sort((a, b) => {
      const oa = MATURITY_CONFIG[a.maturity ?? 'planned']?.order ?? 0;
      const ob = MATURITY_CONFIG[b.maturity ?? 'planned']?.order ?? 0;
      return ob - oa;
    });
  }
  return map;
}

function MaturityTag({ maturity }: { maturity: string }) {
  const config = MATURITY_CONFIG[maturity] ?? MATURITY_CONFIG.planned;
  return (
    <Tag color={config.color} icon={config.icon}>
      {config.label}
    </Tag>
  );
}

function SummaryBar({ caps }: { caps: CognitiveNode[] }) {
  const counts = { stable: 0, beta: 0, alpha: 0, planned: 0, deprecated: 0 };
  for (const c of caps) {
    const m = c.maturity ?? 'planned';
    if (m in counts) counts[m as keyof typeof counts]++;
  }
  const total = caps.length;
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

function CapabilityCard({ cap }: { cap: CognitiveNode }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Typography.Text strong>{cap.title}</Typography.Text>
            <MaturityTag maturity={cap.maturity ?? 'planned'} />
          </div>
          {cap.description && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {cap.description}
            </Typography.Text>
          )}
          {cap.scope && (
            <div style={{ marginTop: 6 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                边界: {cap.scope}
              </Typography.Text>
            </div>
          )}
          {cap.acceptanceCriteria && cap.acceptanceCriteria.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, color: '#666' }}>
              {cap.acceptanceCriteria.map((ac, i) => (
                <li key={i}>{ac}</li>
              ))}
            </ul>
          )}
        </div>
        {cap.tags.length > 0 && (
          <Space size={[4, 4]} wrap>
            {cap.tags.map(t => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
          </Space>
        )}
      </div>
    </Card>
  );
}

export function CapabilitiesView({ slug }: Props) {
  const { data, error, isLoading } = useSWR(
    `${slug}/capabilities`,
    () => fetchCapabilities(slug),
    { refreshInterval: 30_000 },
  );

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;

  const caps = data ?? [];
  if (caps.length === 0) {
    return (
      <Empty
        description="尚未定义任何能力节点"
        style={{ marginTop: 64 }}
      />
    );
  }

  const byDomain = groupByDomain(caps);

  return (
    <div style={{ maxWidth: 900 }}>
      <SummaryBar caps={caps} />
      {Array.from(byDomain).map(([domain, items]) => (
        <div key={domain} style={{ marginBottom: 24 }}>
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            {domain}
          </Typography.Title>
          {items.map(cap => (
            <CapabilityCard key={cap.id} cap={cap} />
          ))}
        </div>
      ))}
    </div>
  );
}
