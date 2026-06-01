import { Card, Typography, Empty } from 'antd';

export function ToolsView({ slug }: { slug: string }) {
  return (
    <Card>
      <Typography.Title level={5}>工具箱</Typography.Title>
      <Empty description="移动安全工具链 (jadx, adb, frida, aapt)" />
    </Card>
  );
}
