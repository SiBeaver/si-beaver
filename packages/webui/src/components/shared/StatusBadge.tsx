import { Tag } from 'antd';
import { STATUS_COLORS, STATUS_LABELS } from '../../lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'default';
  const label = STATUS_LABELS[status] ?? status;
  return <Tag color={color}>{label}</Tag>;
}
