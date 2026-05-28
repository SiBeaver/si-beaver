import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Button, Typography, App, Space } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { setToken } from '../lib/auth';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [token, setTokenValue] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const handleLogin = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      message.warning('请输入 Token');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/projects', {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (res.status === 401) {
        message.error('Token 无效，访问被拒绝');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        message.error(`服务器错误: ${res.status}`);
        setLoading(false);
        return;
      }
      // Token valid — store and redirect
      setToken(trimmed);
      message.success('验证通过');
      navigate('/projects', { replace: true });
    } catch {
      message.error('网络错误，无法连接服务器');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--ant-color-bg-layout)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <KeyOutlined style={{ fontSize: 36, color: 'var(--ant-color-primary)', marginBottom: 8 }} />
            <Title level={3} style={{ margin: 0 }}>si-beaver</Title>
            <Text type="secondary">请输入系统 Token 以访问 Dashboard</Text>
          </div>

          <Input.Password
            placeholder="粘贴 Token"
            value={token}
            onChange={(e) => setTokenValue(e.target.value)}
            onPressEnter={handleLogin}
            size="large"
            autoFocus
          />

          <Button
            type="primary"
            block
            size="large"
            loading={loading}
            onClick={handleLogin}
          >
            验证并登录
          </Button>
        </Space>
      </Card>
    </div>
  );
}
