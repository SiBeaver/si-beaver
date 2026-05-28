import { Skeleton, Alert, Typography, Row, Col, Card, Statistic, theme } from 'antd';
import { WarningOutlined, BugOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useBlockers } from '../../hooks/useBlockers';
import { useProjectState } from '../../hooks/useProjectState';
import { BlockerCard } from '../blockers/BlockerCard';
import { RiskMatrix } from '../blockers/RiskMatrix';
import { TechDebtList } from '../blockers/TechDebtList';
import { EmptyState } from '../shared/EmptyState';

export function RisksView({ slug }: { slug: string }) {
  const { data: blockersData, error: blockersError, isLoading: blockersLoading } = useBlockers(slug);
  const { data: stateData, isLoading: stateLoading } = useProjectState(slug);
  const { token } = theme.useToken();

  if (blockersLoading || stateLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (blockersError) return <Alert type="error" message="加载失败" description={blockersError.message} showIcon />;

  const blockers = blockersData?.blockers ?? [];
  const risks = stateData?.openRisks ?? [];
  const techDebt = stateData?.criticalTechDebt ?? [];
  const hasContent = blockers.length > 0 || risks.length > 0 || techDebt.length > 0;

  if (!hasContent) {
    return <EmptyState title="暂无风险或阻塞" description="当前项目没有未解决的风险、技术债或阻塞项。" />;
  }

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col span={8}>
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '20px 16px' } }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>活跃阻塞</span>}
              value={blockers.length}
              prefix={<WarningOutlined style={{ color: token.colorError }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '20px 16px' } }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>未解决风险</span>}
              value={risks.length}
              prefix={<BugOutlined style={{ color: token.colorWarning }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '20px 16px' } }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>关键技术债</span>}
              value={techDebt.length}
              prefix={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Blockers */}
      {blockers.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <Typography.Title level={5} style={{ marginBottom: 16 }}>活跃阻塞</Typography.Title>
          {blockers.map(b => (
            <BlockerCard key={b.blocker.id} item={b} />
          ))}
        </div>
      )}

      {/* Risk matrix */}
      {risks.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <RiskMatrix risks={risks} />
        </div>
      )}

      {/* Tech debt */}
      <TechDebtList items={techDebt} />
    </div>
  );
}
