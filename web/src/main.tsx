import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme as antTheme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { SWRConfig } from 'swr';
import './index.css';
import { router } from './router';
import { useThemeMode } from './hooks/useThemeMode';

function Root() {
  const mode = useThemeMode();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: mode === 'dark' ? '#3b82f6' : '#2563eb',
          borderRadius: 12,
          borderRadiusSM: 8,
          borderRadiusLG: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          colorBgContainer: mode === 'dark' ? '#2a2a2a' : '#ffffff',
          colorBgLayout: mode === 'dark' ? '#1a1a1a' : '#f8f9fa',
          colorText: mode === 'dark' ? '#e5e5e5' : '#1a1a1a',
          colorTextSecondary: mode === 'dark' ? '#9ca3af' : '#6b7280',
          colorSuccess: mode === 'dark' ? '#4ade80' : '#16a34a',
          colorWarning: mode === 'dark' ? '#fbbf24' : '#d97706',
          colorError: mode === 'dark' ? '#f87171' : '#dc2626',
        },
        components: {
          Card: {
            borderRadiusLG: 12,
          },
          Tag: {
            borderRadiusSM: 8,
          },
          Menu: {
            itemBorderRadius: 8,
          },
        },
      }}
    >
      <AntApp>
        <SWRConfig value={{ revalidateOnFocus: true }}>
          <RouterProvider router={router} />
        </SWRConfig>
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
