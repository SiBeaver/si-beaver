import { Progress } from 'antd';

interface ProgressBarProps {
  done: number;
  total: number;
  showLabel?: boolean;
}

export function ProgressBar({ done, total, showLabel = true }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Progress
      percent={pct}
      size="small"
      format={() => showLabel ? `${done}/${total}` : `${pct}%`}
      strokeColor={pct === 100 ? '#52c41a' : '#1677ff'}
    />
  );
}
