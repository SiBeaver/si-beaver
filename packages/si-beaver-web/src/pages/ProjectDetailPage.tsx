import { useState, useEffect, createElement } from 'react';
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
  BookOutlined,
  AppstoreOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useSWRConfig } from 'swr';
import { CockpitView } from '../components/cockpit/CockpitView';
import { WhatView } from '../components/what/WhatView';
import { DesignView } from '../components/design/DesignView';
import { GoalsView } from '../components/goals/GoalsView';
import { TasksView } from '../components/tasks/TasksView';
import { RequirementsView } from '../components/requirements/RequirementsView';
import { KnowledgeBaseView } from '../components/knowledge/KnowledgeBaseView';
import { HowtoView } from '../components/howto/HowtoView';
import { CapabilitiesView } from '../components/capabilities/CapabilitiesView';
import { clearToken } from '../lib/auth';
import { LEGACY_TO_NEW } from '../lib/constants';
import type { LegacyTab } from '../lib/constants';
import { getPlugins } from '../plugin/registry';
import type { TabPlugin } from '../plugin/types';

const { Sider, Content } = Layout;

const BASE_TABS: (TabPlugin & { builtin: true })[] = [
  { key: 'cockpit', label: '驾驶舱', icon: DashboardOutlined, component: CockpitView, builtin: true },
  { key: 'what', label: '是什么', icon: InfoCircleOutlined, component: WhatView, builtin: true },
  { key: 'design', label: '设计', icon: BuildOutlined, component: DesignView, builtin: true },
  { key: 'goals', label: '目标', icon: FlagOutlined, component: GoalsView, builtin: true },
  { key: 'tasks', label: '任务', icon: UnorderedListOutlined, component: TasksView, builtin: true },
  { key: 'requirements', label: '需求', icon: FileTextOutlined, component: RequirementsView, builtin: true },
  { key: 'capabilities', label: '交付', icon: AppstoreOutlined, component: CapabilitiesView, builtin: true },
  { key: 'knowledge', label: '知识库', icon: BookOutlined, component: KnowledgeBaseView, builtin: true },
  { key: 'howto', label: '怎么用', icon: QuestionCircleOutlined, component: HowtoView, builtin: true },
];

function getAllTabs(): TabPlugin[] {
  const plugins = getPlugins();
  const pluginKeys = new Set(plugins.map(p => p.key));
  // base tabs first, then plugins, skip plugins that override base keys
  const baseFiltered = BASE_TABS.filter(t => !pluginKeys.has(t.key));
  return [...baseFiltered, ...plugins];
}

export function ProjectDetailPage() {
  const { slug, tab } = useParams<{ slug: string; tab: string }>();
  const allTabs = getAllTabs();
  const activeTab = tab || 'cockpit';
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const [spinning, setSpinning] = useState(false);
  const { token } = theme.useToken();

  const tabMap = new Map(allTabs.map(t => [t.key, t]));
  const activePlugin = tabMap.get(activeTab);

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
          items={allTabs.map(t => ({
            key: t.key,
            icon: createElement(t.icon as any, { style: { fontSize: 18 } }),
            label: t.label,
          }))}
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
            {activePlugin?.label ?? activeTab}
          </Typography.Title>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={spinning} />}
            onClick={handleRefresh}
          />
        </div>
        <Content style={{ padding: 32, overflow: 'auto' }}>
          {activePlugin && <activePlugin.component slug={slug!} />}
        </Content>
      </Layout>
    </Layout>
  );
}
