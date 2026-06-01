import { Card, Typography, Empty } from 'antd';

export function WorkflowsView({ slug }: { slug: string }) {
  return (
    <Card>
      <Typography.Title level={5}>工作流</Typography.Title>
      <Empty description="工作流引擎已就绪" />
    </Card>
  );
}
