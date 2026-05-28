import { Skeleton, Alert } from 'antd';
import { useRoadmap } from '../../hooks/useRoadmap';
import { GoalTreeNode } from './GoalTreeNode';
import { EmptyState } from '../shared/EmptyState';

interface Props {
  slug: string;
  onContextClick?: (nodeId: string) => void;
}

export function RoadmapView({ slug, onContextClick }: Props) {
  const { data, error, isLoading } = useRoadmap(slug);

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;

  if (!data || data.roadmap.length === 0) {
    return <EmptyState title="暂无目标" description="通过 MCP 或 REST API 创建目标后，路线图将在此显示。" />;
  }

  return (
    <div style={{ maxWidth: 960 }}>
      {data.roadmap.map(item => (
        <GoalTreeNode key={item.node.id} item={item} onContextClick={onContextClick} />
      ))}
    </div>
  );
}
