import { Typography, theme } from 'antd';
import { LIKELIHOOD_LABELS, IMPACT_LABELS } from '../../lib/constants';
import type { CognitiveNode } from '../../lib/types';

const LIKELIHOODS = ['high', 'medium', 'low'] as const;
const IMPACTS = ['low', 'medium', 'high', 'critical'] as const;

const CELL_BG_LIGHT: Record<string, string> = {
  'high-critical': 'rgba(220,38,38,0.15)',
  'high-high': 'rgba(220,38,38,0.1)',
  'high-medium': 'rgba(217,119,6,0.1)',
  'high-low': 'rgba(217,119,6,0.06)',
  'medium-critical': 'rgba(220,38,38,0.1)',
  'medium-high': 'rgba(217,119,6,0.1)',
  'medium-medium': 'rgba(217,119,6,0.06)',
  'medium-low': 'rgba(0,0,0,0.03)',
  'low-critical': 'rgba(217,119,6,0.06)',
  'low-high': 'rgba(217,119,6,0.04)',
  'low-medium': 'rgba(0,0,0,0.02)',
  'low-low': 'rgba(0,0,0,0.01)',
};

const CELL_BG_DARK: Record<string, string> = {
  'high-critical': 'rgba(255,77,79,0.3)',
  'high-high': 'rgba(255,77,79,0.2)',
  'high-medium': 'rgba(250,140,22,0.2)',
  'high-low': 'rgba(250,173,20,0.15)',
  'medium-critical': 'rgba(255,77,79,0.2)',
  'medium-high': 'rgba(250,140,22,0.2)',
  'medium-medium': 'rgba(250,173,20,0.15)',
  'medium-low': 'rgba(255,255,255,0.06)',
  'low-critical': 'rgba(250,140,22,0.15)',
  'low-high': 'rgba(250,173,20,0.15)',
  'low-medium': 'rgba(255,255,255,0.06)',
  'low-low': 'rgba(255,255,255,0.03)',
};

export function RiskMatrix({ risks }: { risks: CognitiveNode[] }) {
  const { token } = theme.useToken();
  const isDark = token.colorBgLayout === '#1a1a1a';
  const cellBg = isDark ? CELL_BG_DARK : CELL_BG_LIGHT;

  const counts: Record<string, number> = {};
  for (const r of risks) {
    if (r.likelihood && r.impact) {
      const key = `${r.likelihood}-${r.impact}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return (
    <div>
      <Typography.Title level={5} style={{ marginBottom: 16 }}>风险矩阵</Typography.Title>
      <div style={{ display: 'inline-block' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <div style={{ width: 64 }} />
          {IMPACTS.map(impact => (
            <div key={impact} style={{ width: 64, textAlign: 'center', fontSize: 11, color: token.colorTextSecondary }}>
              {IMPACT_LABELS[impact] ?? impact}
            </div>
          ))}
        </div>
        {LIKELIHOODS.map(likelihood => (
          <div key={likelihood} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <div style={{ width: 64, textAlign: 'right', paddingRight: 8, fontSize: 11, color: token.colorTextSecondary }}>
              {LIKELIHOOD_LABELS[likelihood] ?? likelihood}
            </div>
            {IMPACTS.map(impact => {
              const key = `${likelihood}-${impact}`;
              const count = counts[key] ?? 0;
              return (
                <div
                  key={key}
                  title={`${likelihood} / ${impact}: ${count}`}
                  style={{
                    width: 64,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    background: count > 0 ? (cellBg[key] ?? token.colorFillQuaternary) : token.colorFillQuaternary,
                    color: count > 0 ? token.colorText : 'transparent',
                  }}
                >
                  {count > 0 ? count : ''}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: 'flex', marginTop: 6 }}>
          <div style={{ width: 64 }} />
          <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: token.colorTextSecondary }}>
            影响 →
          </div>
        </div>
      </div>
    </div>
  );
}
