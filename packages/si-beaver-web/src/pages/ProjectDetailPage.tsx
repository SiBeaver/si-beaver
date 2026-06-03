import { useState, createElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Menu, Typography, Button, theme } from 'antd';
import {
  ReloadOutlined,
  ArrowLeftOutlined,
  LogoutOutlined,
  CompassOutlined,
  MessageOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useSWRConfig } from 'swr';
import { CockpitView } from '../components/cockpit/CockpitView';
import { HelmView } from '../components/helm/HelmView';
import { ChatPanel } from '../components/chat/ChatPanel';
import { clearToken } from '../lib/auth';
import { getPlugins } from '../plugin/registry';
import type { TabPlugin } from '../plugin/types';

const { Sider, Content } = Layout;

const BASE_TABS: (TabPlugin & { builtin: true })[] = [
  { key: 'cockpit', label: '地图', icon: GlobalOutlined, component: CockpitView, builtin: true },
  { key: 'helm', label: '方向舵', icon: CompassOutlined, component: HelmView, builtin: true },
];

function getAllTabs(): TabPlugin[] {
  const plugins = getPlugins();
  const pluginKeys = new Set(plugins.map(p => p.key));
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
  const [chatOpen, setChatOpen] = useState(false);
  const { token } = theme.useToken();

  const tabMap = new Map(allTabs.map(t => [t.key, t]));
  const activePlugin = tabMap.get(activeTab);

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
          onClick={() => navigate('/')}
        >
          <ArrowLeftOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
        </div>
        <Menu
          mode="inline"
          inlineCollapsed
          selectedKeys={[activeTab]}
          onSelect={({ key }) => navigate(`/${slug}/${key}`)}
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
            marginBottom: 12,
            cursor: 'pointer',
            color: chatOpen ? token.colorPrimary : token.colorTextSecondary,
            background: chatOpen ? token.colorPrimaryBg : undefined,
          }}
          onClick={() => setChatOpen(!chatOpen)}
          title="对话"
        >
          <MessageOutlined style={{ fontSize: 16 }} />
        </div>
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
        <Layout style={{ background: token.colorBgLayout }}>
          <Content style={{ padding: 32, overflow: 'auto' }}>
            {activePlugin && <activePlugin.component slug={slug!} />}
          </Content>
          {chatOpen && (
            <Sider
              width={360}
              style={{
                background: token.colorBgContainer,
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography.Text strong style={{ marginBottom: 12, display: 'block' }}>对话</Typography.Text>
              <ChatPanel slug={slug!} />
            </Sider>
          )}
        </Layout>
      </Layout>
    </Layout>
  );
}
