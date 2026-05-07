import { Card, Space, Tag, Typography, Descriptions } from 'antd';
import { StatusBadge } from '../shared/StatusBadge';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { SEVERITY_COLORS } from '../../lib/constants';
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
          {severityLabel && <Tag color={SEVERITY_COLORS[severityLabel] ?? 'default'}>{severityLabel}</Tag>}
          <StatusBadge status={blocker.status} />
        </div>

        {blocker.description && (
          <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
            {blocker.description}
          </Typography.Paragraph>
        )}

        {blocker.type === 'risk' && (
          <Descriptions size="small" column={3} bordered={false}>
            {blocker.likelihood && <Descriptions.Item label="可能性">{blocker.likelihood}</Descriptions.Item>}
            {blocker.impact && <Descriptions.Item label="影响">{blocker.impact}</Descriptions.Item>}
            {blocker.mitigation_strategy && <Descriptions.Item label="缓解策略">{blocker.mitigation_strategy}</Descriptions.Item>}
          </Descriptions>
        )}

        {blocker.type === 'tech_debt' && (
          <Descriptions size="small" column={2} bordered={false}>
            {blocker.affected_area && <Descriptions.Item label="影响区域">{blocker.affected_area}</Descriptions.Item>}
            {blocker.cost_of_delay && <Descriptions.Item label="延迟代价">{blocker.cost_of_delay}</Descriptions.Item>}
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
