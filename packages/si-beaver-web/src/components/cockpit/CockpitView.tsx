import { useState } from 'react';
import { Typography, Tag, Skeleton, Alert, Empty, Space, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import useSWR from 'swr';
import { fetchCockpitView } from '../../api/client';
import type { CapabilityTreeNode, CockpitLayer } from '../../api/client';

interface Props {
  slug: string;
}

const MATURITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  stable: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' },
  beta: { bg: '#e6f4ff', border: '#91caff', text: '#1677ff' },
  alpha: { bg: '#fff7e6', border: '#ffd591', text: '#d46b08' },
  planned: { bg: '#f5f5f5', border: '#d9d9d9', text: '#8c8c8c' },
};

const MATURITY_ICONS: Record<string, React.ReactNode> = {
  stable: <CheckCircleOutlined />,
  beta: <ThunderboltOutlined />,
  alpha: <ExperimentOutlined />,
  planned: <ClockCircleOutlined />,
};

function CapabilityBlock({ cap }: { cap: CapabilityTreeNode }) {
  const [expanded, setExpanded] = useState(false);
  const colors = MATURITY_COLORS[cap.maturity] ?? MATURITY_COLORS.planned;

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: colors.bg,
        padding: '12px 16px',
        minWidth: 180,
        flex: '1 1 auto',
        cursor: cap.children.length > 0 ? 'pointer' : 'default',
      }}
      onClick={() => cap.children.length > 0 && setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {cap.children.length > 0 && (
          expanded
            ? <DownOutlined style={{ fontSize: 10, color: colors.text }} />
            : <RightOutlined style={{ fontSize: 10, color: colors.text }} />
        )}
        <span style={{ color: colors.text, fontSize: 13 }}>
          {MATURITY_ICONS[cap.maturity]}
        </span>
        <Typography.Text strong style={{ fontSize: 14, color: colors.text }}>
          {cap.title}
        </Typography.Text>
      </div>
      {cap.description && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          {cap.description.length > 60 ? cap.description.slice(0, 60) + '...' : cap.description}
        </Typography.Text>
      )}
      {!expanded && cap.children.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <Space size={[4, 4]} wrap>
            {cap.children.map(child => {
              const cc = MATURITY_COLORS[child.maturity] ?? MATURITY_COLORS.planned;
              return (
                <Tooltip key={child.id} title={child.title}>
                  <Tag
                    style={{ fontSize: 11, margin: 0, color: cc.text, borderColor: cc.border, background: cc.bg }}
                  >
                    {child.title.length > 8 ? child.title.slice(0, 8) + '..' : child.title}
                  </Tag>
                </Tooltip>
              );
            })}
          </Space>
        </div>
      )}
      {expanded && cap.children.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${colors.border}` }}>
          {cap.children.map(child => {
            const cc = MATURITY_COLORS[child.maturity] ?? MATURITY_COLORS.planned;
            return (
              <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: cc.text, fontSize: 12 }}>{MATURITY_ICONS[child.maturity]}</span>
                <Typography.Text style={{ fontSize: 13 }}>{child.title}</Typography.Text>
                <Tag color={cc.text === '#389e0d' ? 'green' : cc.text === '#1677ff' ? 'blue' : cc.text === '#d46b08' ? 'orange' : 'default'} style={{ fontSize: 11 }}>
                  {child.maturity}
                </Tag>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LayerRow({ layer, isBottom }: { layer: CockpitLayer; isBottom: boolean }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 12,
          padding: '16px 20px',
          borderRadius: 8,
          border: '1px solid #e8e8e8',
          borderBottom: isBottom ? '3px solid #52c41a' : '1px solid #e8e8e8',
          background: isBottom ? '#fafffe' : '#fff',
        }}
      >
        <div style={{ minWidth: 64, display: 'flex', alignItems: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            {layer.label}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          {layer.capabilities.map(cap => (
            <CapabilityBlock key={cap.id} cap={cap} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CockpitView({ slug }: Props) {
  const { data, error, isLoading } = useSWR(
    `${slug}/cockpit-view`,
    () => fetchCockpitView(slug),
    { refreshInterval: 60_000 },
  );

  if (isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (error) return <Alert type="error" message="驾驶舱加载失败" description={error.message} showIcon />;

  const layers = data?.layers ?? [];
  if (layers.length === 0) {
    return <Empty description="未配置驾驶舱视图" style={{ marginTop: 64 }} />;
  }

  const reversedLayers = [...layers].reverse();

  return (
    <div style={{ maxWidth: 1000 }}>
      <Typography.Title level={4} style={{ marginBottom: 20 }}>
        系统架构
      </Typography.Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {reversedLayers.map((layer, i) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isBottom={i === reversedLayers.length - 1}
          />
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Space>
          <Tag color="green" icon={<CheckCircleOutlined />}>Stable</Tag>
          <Tag color="blue" icon={<ThunderboltOutlined />}>Beta</Tag>
          <Tag color="orange" icon={<ExperimentOutlined />}>Alpha</Tag>
          <Tag icon={<ClockCircleOutlined />}>Planned</Tag>
        </Space>
      </div>
    </div>
  );
}
