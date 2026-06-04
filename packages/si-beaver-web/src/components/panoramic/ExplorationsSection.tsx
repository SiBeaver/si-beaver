import { Card, List, Typography } from 'antd';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';
import type { CognitiveNode } from '../../lib/types';

interface ExplorationsSectionProps {
  explorations: CognitiveNode[];
}

export function ExplorationsSection({ explorations }: ExplorationsSectionProps) {
  if (!explorations.length) {
    return (
      <Card title="探索管理" size="small" style={{ height: '100%' }}>
        <EmptyState title="无进行中探索" description="当前没有活跃的探索" />
      </Card>
    );
  }

  return (
    <Card title="探索管理" size="small" style={{ height: '100%' }}>
      <List
        size="small"
        dataSource={explorations.slice(0, 6)}
        renderItem={exp => (
          <List.Item style={{ padding: '6px 0' }}>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={exp.status} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{exp.title}</span>
                <TimeAgo date={exp.updatedAt} />
              </div>
              {exp.hypothesis && (
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }} ellipsis>
                  {exp.hypothesis}
                </Typography.Text>
              )}
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
