import { Tag } from 'antd';
import { NODE_TYPE_COLORS, NODE_TYPE_LABELS } from '../../lib/constants';
import type { CognitiveNode } from '../../lib/types';

export function NodeTypeBadge({ type }: { type: CognitiveNode['type'] }) {
  return <Tag color={NODE_TYPE_COLORS[type]}>{NODE_TYPE_LABELS[type]}</Tag>;
}
