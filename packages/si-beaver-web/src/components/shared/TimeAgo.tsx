import { Typography } from 'antd';

const UNITS: [string, number][] = [
  ['年', 365 * 24 * 60 * 60 * 1000],
  ['月', 30 * 24 * 60 * 60 * 1000],
  ['天', 24 * 60 * 60 * 1000],
  ['小时', 60 * 60 * 1000],
  ['分钟', 60 * 1000],
];

export function TimeAgo({ date }: { date: string }) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60 * 1000) return <Typography.Text type="secondary" style={{ fontSize: 12 }}>刚刚</Typography.Text>;

  for (const [unit, ms] of UNITS) {
    const val = Math.floor(diff / ms);
    if (val > 0) {
      return <Typography.Text type="secondary" style={{ fontSize: 12 }}>{val} {unit}前</Typography.Text>;
    }
  }
  return <Typography.Text type="secondary" style={{ fontSize: 12 }}>刚刚</Typography.Text>;
}
