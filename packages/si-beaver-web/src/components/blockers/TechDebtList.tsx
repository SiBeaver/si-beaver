import { Table, Tag, Typography } from 'antd';
import { StatusBadge } from '../shared/StatusBadge';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '../../lib/constants';
import type { CognitiveNode } from '../../lib/types';

const columns = [
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    render: (text: string) => <Typography.Text>{text}</Typography.Text>,
  },
  {
    title: '严重程度',
    dataIndex: 'severity',
    key: 'severity',
    width: 100,
    render: (val: string | undefined) =>
      val ? <Tag color={SEVERITY_COLORS[val] ?? 'default'}>{SEVERITY_LABELS[val] ?? val}</Tag> : '-',
  },
  {
    title: '影响区域',
    dataIndex: 'affectedArea',
    key: 'affectedArea',
    render: (val: string | undefined) =>
      <Typography.Text type="secondary">{val ?? '-'}</Typography.Text>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (status: string) => <StatusBadge status={status} />,
  },
  {
    title: '延迟代价',
    dataIndex: 'costOfDelay',
    key: 'costOfDelay',
    render: (val: string | undefined) =>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{val ?? '-'}</Typography.Text>,
  },
];

export function TechDebtList({ items }: { items: CognitiveNode[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <Typography.Title level={5} style={{ marginBottom: 16 }}>技术债</Typography.Title>
      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      />
    </div>
  );
}
