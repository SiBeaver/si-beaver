import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Badge, theme, Space } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, MessageOutlined, LogoutOutlined } from '@ant-design/icons';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { CockpitView } from '../components/cockpit/CockpitView';
import { ChatPanel } from '../components/chat/ChatPanel';
import { CapabilityPanel } from '../components/capability/CapabilityPanel';
import { clearToken } from '../lib/auth';
import { fetchHelmSignals } from '../api/client';
import type { CapabilityTreeNode } from '../api/client';

export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const [spinning, setSpinning] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityTreeNode | null>(null);
  const { token } = theme.useToken();

  const { data: helmData } = useSWR(
    `${slug}/helm-count`,
    () => fetchHelmSignals(slug!),
    { refreshInterval: 30_000 },
  );
  const alertCount = helmData?.signals?.length ?? 0;

  const panelOpen = selectedCapability !== null || chatOpen;

  const handleRefresh = () => {
    setSpinning(true);
    mutate(() => true, undefined, { revalidate: true });
    setTimeout(() => setSpinning(false), 600);
  };

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  const handleToggleChat = () => {
    if (chatOpen) {
      setChatOpen(false);
    } else {
      setChatOpen(true);
      setSelectedCapability(null);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: token.colorBgLayout }}>
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        flexShrink: 0,
      }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        <Typography.Title level={5} style={{ margin: '0 16px', flex: 1 }}>{slug}</Typography.Title>
        <Space size={4}>
          {alertCount > 0 && <Badge count={alertCount} size="small" />}
          <Button type="text" size="small" icon={<ReloadOutlined spin={spinning} />} onClick={handleRefresh} />
          <Button type="text" size="small" icon={<MessageOutlined />} onClick={handleToggleChat} />
          <Button type="text" size="small" icon={<LogoutOutlined />} onClick={handleLogout} />
        </Space>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: panelOpen ? 24 : 32 }}>
          <CockpitView slug={slug!} onSelectCapability={setSelectedCapability} />
        </div>

        {panelOpen && (
          <div style={{
            width: 380,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            overflow: 'auto',
            flexShrink: 0,
          }}>
            {selectedCapability && (
              <CapabilityPanel
                capability={selectedCapability}
                onClose={() => setSelectedCapability(null)}
              />
            )}
            {chatOpen && !selectedCapability && (
              <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography.Text strong style={{ marginBottom: 12 }}>对话</Typography.Text>
                <ChatPanel slug={slug!} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
