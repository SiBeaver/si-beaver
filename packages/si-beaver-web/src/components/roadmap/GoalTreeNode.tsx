import { useState } from 'react';
import { theme } from 'antd';
import { GoalCard } from './GoalCard';
import { NODE_TYPE_COLORS } from '../../lib/constants';
import type { RoadmapItem } from '../../lib/types';

interface GoalTreeNodeProps {
  item: RoadmapItem;
  depth?: number;
  onContextClick?: (nodeId: string) => void;
}

const BORDER_COLORS: Record<string, [string, string]> = {
  blue: ['#2563eb', '#3b82f6'],
  green: ['#16a34a', '#4ade80'],
  purple: ['#7c3aed', '#a78bfa'],
  gold: ['#d97706', '#fbbf24'],
  red: ['#dc2626', '#f87171'],
  orange: ['#ea580c', '#fb923c'],
  cyan: ['#0891b2', '#22d3ee'],
  geekblue: ['#2563eb', '#60a5fa'],
};

export function GoalTreeNode({ item, depth = 0, onContextClick }: GoalTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const { token } = theme.useToken();
  const isDark = token.colorBgLayout === '#1a1a1a';
  const colorKey = NODE_TYPE_COLORS[item.node.type] ?? 'blue';
  const borderColor = (BORDER_COLORS[colorKey] ?? ['#6b7280', '#9ca3af'])[isDark ? 1 : 0];

  return (
    <div style={depth > 0 ? {
      marginLeft: 20,
      borderLeft: `2px solid ${borderColor}`,
      paddingLeft: 12,
      marginTop: 4,
    } : { marginTop: depth === 0 ? 0 : 4 }}>
      <GoalCard
        node={item.node}
        progress={item.progress}
        hasChildren={item.children.length > 0}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        onContextClick={onContextClick ? () => onContextClick(item.node.id) : undefined}
      />
      {expanded && item.children.length > 0 && (
        <div>
          {item.children.map(child => (
            <GoalTreeNode key={child.node.id} item={child} depth={depth + 1} onContextClick={onContextClick} />
          ))}
        </div>
      )}
    </div>
  );
}
