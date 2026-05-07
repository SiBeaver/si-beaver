import { Tag } from 'antd';
import { STATUS_COLORS } from '../../lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'default';
  return <Tag color={color}>{status.replace(/_/g, ' ')}</Tag>;
}
