import { Row, Col, Card, Statistic, Typography, Skeleton, Alert, theme, List } from 'antd';
import {
  AimOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useProjectState } from '../../hooks/useProjectState';
import { NodeTypeBadge } from '../shared/NodeTypeBadge';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';

export function OverviewView({ slug }: { slug: string }) {
  const { data, error, isLoading } = useProjectState(slug);
  const { token } = theme.useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;
  if (!data) return <EmptyState title="暂无数据" description="启动 API 服务后数据将在此显示。" />;

  const { statistics, recentDecisions, activeGoals, pendingTasks } = data;

  const statCards = [
    { title: '活跃目标', value: statistics.totalGoals - statistics.achievedGoals, icon: <AimOutlined />, color: token.colorPrimary },
    { title: '已达成', value: statistics.achievedGoals, icon: <CheckCircleOutlined />, color: token.colorSuccess },
    { title: '待办任务', value: statistics.pendingTasks, icon: <UnorderedListOutlined />, color: token.colorWarning },
    { title: '未解决风险', value: statistics.openRisks, icon: <WarningOutlined />, color: token.colorError },
    { title: '技术债', value: statistics.techDebtItems, icon: <ThunderboltOutlined />, color: '#fa8c16' },
  ];

  // Combine recent items for activity feed
  const recentItems = [
    ...recentDecisions,
    ...activeGoals.slice(0, 3),
    ...pendingTasks.slice(0, 3),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Stats row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {statCards.map(s => (
          <Col key={s.title} xs={12} sm={8} md={4} lg={4}>
            <Card
              style={{ borderRadius: 12, height: '100%' }}
              styles={{ body: { padding: '20px 16px' } }}
            >
              <Statistic
                title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                value={s.value}
                prefix={<span style={{ color: s.color }}>{s.icon}</span>}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Recent activity */}
      <Typography.Title level={5} style={{ marginBottom: 16 }}>最近动态</Typography.Title>
      {recentItems.length === 0 ? (
        <EmptyState title="暂无动态" description="项目活动将在此展示。" />
      ) : (
        <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
          <List
            dataSource={recentItems}
            renderItem={(item) => (
              <List.Item style={{ padding: '12px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <NodeTypeBadge type={item.type} />
                  <Typography.Text ellipsis style={{ flex: 1 }}>{item.title}</Typography.Text>
                  <StatusBadge status={item.status} />
                  <TimeAgo date={item.updatedAt} />
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
