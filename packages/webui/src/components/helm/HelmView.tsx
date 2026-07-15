import { Skeleton, Alert, Typography, Space, Tag, theme } from 'antd';
import { CompassOutlined } from '@ant-design/icons';
import useSWR from 'swr';
import { fetchHelmSignals } from '../../api/client';
import { HelmSignalCard } from './HelmSignalCard';

interface Props {
  slug: string;
}

export function HelmView({ slug }: Props) {
  const { data, error, isLoading, mutate } = useSWR(
    `${slug}/helm`,
    () => fetchHelmSignals(slug),
    { refreshInterval: 15_000 },
  );
  const { token } = theme.useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (error) return <Alert type="error" message="方向舵加载失败" description={error.message} />;

  const signals = data?.signals ?? [];

  if (signals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: token.colorTextSecondary }}>
        <CompassOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
        <div>
          <Typography.Title level={5} type="secondary">一切平稳，无需转向</Typography.Title>
          <Typography.Text type="secondary">当前没有需要你决策的事项</Typography.Text>
        </div>
      </div>
    );
  }

  const counts = data?.counts ?? {};

  return (
    <div style={{ maxWidth: 720 }}>
      <Space size={8} style={{ marginBottom: 16 }}>
        {Object.entries(counts).map(([type, count]) => (
          <Tag key={type}>{type}: {count}</Tag>
        ))}
      </Space>
      <div>
        {signals.map(signal => (
          <HelmSignalCard
            key={signal.id}
            signal={signal}
            slug={slug}
            onAction={() => mutate()}
          />
        ))}
      </div>
    </div>
  );
}
