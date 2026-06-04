import { Card, List, Tag } from 'antd';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { PRIORITY_COLORS } from '../../lib/constants';
import { EmptyState } from '../shared/EmptyState';
import type { CognitiveNode } from '../../lib/types';

interface TasksSectionProps {
  tasks: CognitiveNode[];
}

export function TasksSection({ tasks }: TasksSectionProps) {
  if (!tasks.length) {
    return (
      <Card title="任务追踪" size="small" style={{ height: '100%' }}>
        <EmptyState title="无活跃任务" description="所有任务已完成或未创建" />
      </Card>
    );
  }

  return (
    <Card title="任务追踪" size="small" style={{ height: '100%' }}>
      <List
        size="small"
        dataSource={tasks.slice(0, 8)}
        renderItem={task => (
          <List.Item style={{ padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <StatusBadge status={task.status} />
              <span style={{ flex: 1, fontSize: 13 }}>{task.title}</span>
              {task.priority && <Tag color={PRIORITY_COLORS[task.priority]} style={{ marginRight: 0 }}>{task.priority}</Tag>}
              <TimeAgo date={task.updatedAt} />
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
