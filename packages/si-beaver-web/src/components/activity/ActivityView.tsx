import { useState, useMemo } from 'react';
import { Timeline, Card, Typography, Skeleton, Alert, Select } from 'antd';
import { useActivity } from '../../hooks/useActivity';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { EmptyState } from '../shared/EmptyState';
import { NODE_TYPE_LABELS } from '../../lib/constants';
import type { CognitiveNode, EventRecord } from '../../lib/types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'goal.defined': '定义目标',
  'goal.decomposed': '分解目标',
  'goal.status_changed': '目标状态变更',
  'task.created': '创建任务',
  'task.status_changed': '任务状态变更',
  'decision.recorded': '记录决策',
  'decision.superseded': '取代决策',
  'exploration.started': '开始探索',
  'exploration.finding_recorded': '记录发现',
  'exploration.concluded': '探索结论',
  'exploration.abandoned': '放弃探索',
  'risk.identified': '识别风险',
  'risk.updated': '更新风险',
  'tech_debt.registered': '注册技术债',
  'tech_debt.status_changed': '技术债状态变更',
  'knowledge.recorded': '记录知识',
  'knowledge.invalidated': '知识失效',
  'graph.edge_created': '建立关联',
  'graph.edge_removed': '移除关联',
};

const EVENT_COLORS: Record<string, string> = {
  goal: 'blue',
  task: 'green',
  exploration: 'purple',
  decision: 'gold',
  risk: 'red',
  tech_debt: 'orange',
  knowledge: 'geekblue',
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `今天 ${time}`;
  if (isYesterday) return `昨天 ${time}`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + time;
}

function EventItem({ event }: { event: EventRecord }) {
  const label = EVENT_TYPE_LABELS[event.eventType] ?? event.operation;
  const title = (event.payload?.title as string) ?? '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {event.nodeType && <NodeTypeBadge type={event.nodeType as CognitiveNode['type']} />}
        <Typography.Text strong style={{ fontSize: 13 }}>{label}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatTime(event.timestamp)}</Typography.Text>
      </div>
      {title && (
        <Typography.Text style={{ fontSize: 13, display: 'block', marginTop: 2, paddingLeft: 4 }}>
          {title}
        </Typography.Text>
      )}
      {event.context && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, paddingLeft: 4 }}>
          {event.context}
        </Typography.Text>
      )}
    </div>
  );
}

const NODE_TYPE_OPTIONS = Object.entries(NODE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function ActivityView({ slug }: { slug: string }) {
  const { data, error, isLoading } = useActivity(slug, 100);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    if (!filter) return data.events;
    return data.events.filter(e => e.nodeType === filter);
  }, [data, filter]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;
  if (!data || data.events.length === 0) {
    return <EmptyState title="暂无活动" description="项目事件将在此显示。" />;
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Select
          placeholder="按类型筛选"
          allowClear
          value={filter}
          onChange={setFilter}
          options={NODE_TYPE_OPTIONS}
          style={{ width: 160 }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          共 {filteredEvents.length} 条事件
        </Typography.Text>
      </div>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '20px 24px' } }}>
        <Timeline
          items={filteredEvents.map(ev => ({
            color: EVENT_COLORS[ev.nodeType ?? ''] ?? 'gray',
            children: <EventItem event={ev} />,
          }))}
        />
      </Card>
    </div>
  );
}
