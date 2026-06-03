import { Typography, Tag, Progress, Button, Divider } from 'antd';
import { CloseOutlined, CheckCircleOutlined, ExperimentOutlined, ThunderboltOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { CapabilityTreeNode } from '../../api/client';

interface Props {
  capability: CapabilityTreeNode;
  onClose: () => void;
}

const MATURITY_TAG: Record<string, { color: string; icon: React.ReactNode }> = {
  stable: { color: 'green', icon: <CheckCircleOutlined /> },
  beta: { color: 'blue', icon: <ThunderboltOutlined /> },
  alpha: { color: 'orange', icon: <ExperimentOutlined /> },
  planned: { color: 'default', icon: <ClockCircleOutlined /> },
};

export function CapabilityPanel({ capability, onClose }: Props) {
  const tag = MATURITY_TAG[capability.maturity] ?? MATURITY_TAG.planned;
  const acDone = capability.progress?.done ?? 0;
  const acTotal = capability.progress?.total ?? 0;
  const acPct = acTotal > 0 ? Math.round((acDone / acTotal) * 100) : 0;

  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{capability.title}</Typography.Title>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      <Tag color={tag.color} icon={tag.icon} style={{ marginBottom: 12 }}>
        {capability.maturity}
      </Tag>

      {capability.description && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {capability.description}
        </Typography.Paragraph>
      )}

      {capability.tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {capability.tags.map(t => <Tag key={t}>{t}</Tag>)}
        </div>
      )}

      <Divider style={{ margin: '12px 0' }} />

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        验收标准 ({acDone}/{acTotal})
      </Typography.Text>
      {acTotal > 0 && (
        <Progress percent={acPct} size="small" style={{ marginBottom: 8 }} />
      )}
      {capability.acceptanceCriteria.length > 0 ? (
        <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--ant-color-text-secondary)' }}>
          {capability.acceptanceCriteria.map((ac, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{ac}</li>
          ))}
        </ul>
      ) : (
        <Typography.Text type="secondary">暂无验收标准</Typography.Text>
      )}

      {capability.children.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            子能力 ({capability.children.length})
          </Typography.Text>
          {capability.children.map(child => {
            const ct = MATURITY_TAG[child.maturity] ?? MATURITY_TAG.planned;
            return (
              <div key={child.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color={ct.color} style={{ margin: 0 }}>{child.maturity}</Tag>
                <Typography.Text>{child.title}</Typography.Text>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
