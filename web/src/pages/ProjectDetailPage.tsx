import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Menu, Typography, Button, theme } from 'antd';
import {
  DashboardOutlined,
  NodeIndexOutlined,
  WarningOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useSWRConfig } from 'swr';
import { OverviewView } from '../components/overview/OverviewView';
import { RoadmapView } from '../components/roadmap/RoadmapView';
import { RisksView } from '../components/risks/RisksView';
import type { Tab } from '../lib/constants';

const { Sider, Content } = Layout;

const TAB_TITLES: Record<Tab, string> = {
  overview: '概览',
  roadmap: '路线图',
  risks: '风险',
};

export function ProjectDetailPage() {
  const { slug, tab } = useParams<{ slug: string; tab: string }>();
  const activeTab = (tab as Tab) || 'overview';
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const [spinning, setSpinning] = useState(false);
  const { token } = theme.useToken();

  const handleRefresh = () => {
    setSpinning(true);
    mutate(() => true, undefined, { revalidate: true });
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Sider
        width={72}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 20,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: token.colorPrimaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            marginLeft: 18,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/projects')}
        >
          <ArrowLeftOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
        </div>
        <Menu
          mode="inline"
          inlineCollapsed
          selectedKeys={[activeTab]}
          onSelect={({ key }) => navigate(`/projects/${slug}/${key}`)}
          style={{ border: 'none', background: 'transparent' }}
          items={[
            { key: 'overview', icon: <DashboardOutlined style={{ fontSize: 18 }} />, label: '概览' },
            { key: 'roadmap', icon: <NodeIndexOutlined style={{ fontSize: 18 }} />, label: '路线图' },
            { key: 'risks', icon: <WarningOutlined style={{ fontSize: 18 }} />, label: '风险' },
          ]}
        />
      </Sider>
      <Layout style={{ background: token.colorBgLayout }}>
        <div style={{
          padding: '20px 32px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {TAB_TITLES[activeTab] ?? activeTab}
          </Typography.Title>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={spinning} />}
            onClick={handleRefresh}
          />
        </div>
        <Content style={{ padding: 32, overflow: 'auto' }}>
          {activeTab === 'overview' && <OverviewView slug={slug!} />}
          {activeTab === 'roadmap' && <RoadmapView slug={slug!} />}
          {activeTab === 'risks' && <RisksView slug={slug!} />}
        </Content>
      </Layout>
    </Layout>
  );
}
