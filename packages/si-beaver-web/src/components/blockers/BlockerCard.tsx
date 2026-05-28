import { Card, Space, Tag, Typography, Descriptions } from 'antd';
import { StatusBadge } from '../shared/StatusBadge';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { SEVERITY_COLORS, SEVERITY_LABELS, LIKELIHOOD_LABELS, IMPACT_LABELS } from '../../lib/constants';
import type { BlockerItem } from '../../lib/types';

export function BlockerCard({ item }: { item: BlockerItem }) {
  const { blocker, blocks } = item;
  const severityLabel = blocker.severity ?? blocker.impact ?? null;

  return (
    <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NodeTypeBadge type={blocker.type} />
          <Typography.Text strong style={{ flex: 1 }}>{blocker.title}</Typography.Text>
          {severityLabel && <Tag color={SEVERITY_COLORS[severityLabel] ?? 'default'}>{SEVERITY_LABELS[severityLabel] ?? severityLabel}</Tag>}
          <StatusBadge status={blocker.status} />
        </div>

        {blocker.description && (
          <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
            {blocker.description}
          </Typography.Paragraph>
        )}

        {blocker.type === 'risk' && (
          <Descriptions size="small" column={3} bordered={false}>
            {blocker.likelihood && <Descriptions.Item label="可能性">{LIKELIHOOD_LABELS[blocker.likelihood] ?? blocker.likelihood}</Descriptions.Item>}
            {blocker.impact && <Descriptions.Item label="影响">{IMPACT_LABELS[blocker.impact] ?? blocker.impact}</Descriptions.Item>}
            {blocker.mitigationStrategy && <Descriptions.Item label="缓解策略">{blocker.mitigationStrategy}</Descriptions.Item>}
          </Descriptions>
        )}

        {blocker.type === 'tech_debt' && (
          <Descriptions size="small" column={2} bordered={false}>
            {blocker.affectedArea && <Descriptions.Item label="影响区域">{blocker.affectedArea}</Descriptions.Item>}
            {blocker.costOfDelay && <Descriptions.Item label="延迟代价">{blocker.costOfDelay}</Descriptions.Item>}
          </Descriptions>
        )}

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            阻塞中 ({blocks.length}):
          </Typography.Text>
          <div style={{ marginTop: 4 }}>
            {blocks.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                <NodeTypeBadge type={n.type} />
                <Typography.Text style={{ fontSize: 13 }}>{n.title}</Typography.Text>
                <StatusBadge status={n.status} />
              </div>
            ))}
          </div>
        </div>
      </Space>
    </Card>
  );
}
