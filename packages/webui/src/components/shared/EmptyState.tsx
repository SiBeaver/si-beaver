import { Empty } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Empty
      description={
        <div>
          <div>{title}</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>{description}</div>
        </div>
      }
      style={{ padding: '60px 0' }}
    />
  );
}
