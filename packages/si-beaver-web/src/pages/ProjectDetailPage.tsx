import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Menu, Typography, Button, theme } from 'antd';
import {
  InfoCircleOutlined,
  BuildOutlined,
  FlagOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useSWRConfig } from 'swr';
import { WhatView } from '../components/what/WhatView';
import { DesignView } from '../components/design/DesignView';
import { GoalsView } from '../components/goals/GoalsView';
import { TasksView } from '../components/tasks/TasksView';
import { RequirementsView } from '../components/requirements/RequirementsView';
import { HowtoView } from '../components/howto/HowtoView';
import { clearToken } from '../lib/auth';
import type { Tab, LegacyTab } from '../lib/constants';
import { LEGACY_TO_NEW } from '../lib/constants';

const { Sider, Content } = Layout;

const TAB_TITLES: Record<Tab, string> = {
  what: '是什么',
  design: '设计',
  goals: '目标',
  tasks: '任务',
  requirements: '需求',
  howto: '怎么用',
};

export function ProjectDetailPage() {
  const { slug, tab } = useParams<{ slug: string; tab: string }>();
  const activeTab = (tab as Tab) || 'what';
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const [spinning, setSpinning] = useState(false);
  const { token } = theme.useToken();

  // redirect legacy tab URLs
  useEffect(() => {
    const legacy = LEGACY_TO_NEW[tab as LegacyTab];
    if (legacy) {
      navigate(`/projects/${slug}/${legacy}`, { replace: true });
    }
  }, [tab, slug, navigate]);

  const handleRefresh = () => {
    setSpinning(true);
    mutate(() => true, undefined, { revalidate: true });
    setTimeout(() => setSpinning(false), 600);
  };

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
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
            { key: 'what', icon: <InfoCircleOutlined style={{ fontSize: 18 }} />, label: '是什么' },
            { key: 'design', icon: <BuildOutlined style={{ fontSize: 18 }} />, label: '设计' },
            { key: 'goals', icon: <FlagOutlined style={{ fontSize: 18 }} />, label: '目标' },
            { key: 'tasks', icon: <UnorderedListOutlined style={{ fontSize: 18 }} />, label: '任务' },
            { key: 'requirements', icon: <FileTextOutlined style={{ fontSize: 18 }} />, label: '需求' },
            { key: 'howto', icon: <QuestionCircleOutlined style={{ fontSize: 18 }} />, label: '怎么用' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            cursor: 'pointer',
            color: token.colorTextSecondary,
          }}
          onClick={handleLogout}
          title="登出"
        >
          <LogoutOutlined style={{ fontSize: 16 }} />
        </div>
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
          {activeTab === 'what' && <WhatView slug={slug!} />}
          {activeTab === 'design' && <DesignView slug={slug!} />}
          {activeTab === 'goals' && <GoalsView slug={slug!} />}
          {activeTab === 'tasks' && <TasksView slug={slug!} />}
          {activeTab === 'requirements' && <RequirementsView slug={slug!} />}
          {activeTab === 'howto' && <HowtoView slug={slug!} />}
        </Content>
      </Layout>
    </Layout>
  );
}
