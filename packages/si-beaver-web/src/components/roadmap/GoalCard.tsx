import { useState } from 'react';
import { Card, Space, Tag, Typography, theme } from 'antd';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import { StatusBadge } from '../shared/StatusBadge';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { ProgressBar } from '../shared/ProgressBar';
import { TimeAgo } from '../shared/TimeAgo';
import { PRIORITY_COLORS, PRIORITY_LABELS, HORIZON_LABELS } from '../../lib/constants';
import type { CognitiveNode } from '../../lib/types';

interface GoalCardProps {
  node: CognitiveNode;
  progress: { total: number; done: number };
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  onContextClick?: () => void;
}

export function GoalCard({ node, progress, hasChildren, expanded, onToggle, onContextClick }: GoalCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { token } = theme.useToken();

  const handleClick = () => {
    if (onContextClick) {
      onContextClick();
    } else {
      setShowDetail(!showDetail);
    }
  };

  return (
    <div style={{ marginBottom: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onClick={handleClick}
        onMouseEnter={(e) => (e.currentTarget.style.background = token.colorFillQuaternary)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{ cursor: 'pointer', color: token.colorTextSecondary, fontSize: 11 }}
          >
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        ) : (
          <span style={{ width: 14 }} />
        )}

        <NodeTypeBadge type={node.type} />
        <Typography.Text style={{ flex: 1 }} ellipsis>{node.title}</Typography.Text>

        {node.priority && (
          <Tag color={PRIORITY_COLORS[node.priority] ?? 'default'} bordered={false} style={{ fontSize: 11 }}>
            {PRIORITY_LABELS[node.priority] ?? node.priority}
          </Tag>
        )}

        {node.horizon && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>{HORIZON_LABELS[node.horizon] ?? node.horizon}</Typography.Text>
        )}

        <StatusBadge status={node.status} />

        {progress.total > 0 && (
          <div style={{ width: 120 }}>
            <ProgressBar done={progress.done} total={progress.total} />
          </div>
        )}
      </div>

      {showDetail && (
        <Card
          size="small"
          style={{ marginLeft: 38, marginRight: 12, marginBottom: 8, borderRadius: 10 }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {node.description && (
              <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
                {node.description}
              </Typography.Paragraph>
            )}
            {node.successCriteria && node.successCriteria.length > 0 && (
              <div>
                <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>成功标准:</Typography.Text>
                <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13 }}>
                  {node.successCriteria.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {node.tags.length > 0 && (
              <Space size={4}>
                {node.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
              </Space>
            )}
            <Space size="large">
              <span style={{ fontSize: 12 }}>创建: <TimeAgo date={node.createdAt} /></span>
              <span style={{ fontSize: 12 }}>更新: <TimeAgo date={node.updatedAt} /></span>
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
}
