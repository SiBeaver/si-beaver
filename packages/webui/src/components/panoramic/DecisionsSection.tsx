import { Card, List, Typography } from 'antd';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';
import type { CognitiveNode } from '../../lib/types';

interface DecisionsSectionProps {
  decisions: CognitiveNode[];
}

export function DecisionsSection({ decisions }: DecisionsSectionProps) {
  if (!decisions.length) {
    return (
      <Card title="决策记录" size="small" style={{ height: '100%' }}>
        <EmptyState title="暂无决策" description="还没有记录任何决策" />
      </Card>
    );
  }

  return (
    <Card title="决策记录" size="small" style={{ height: '100%' }}>
      <List
        size="small"
        dataSource={decisions.slice(0, 6)}
        renderItem={dec => (
          <List.Item style={{ padding: '8px 0', borderLeft: '3px solid #faad14', paddingLeft: 12 }}>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{dec.title}</span>
                <TimeAgo date={dec.createdAt} />
              </div>
              {dec.rationale && (
                <Typography.Paragraph
                  type="secondary"
                  style={{ fontSize: 12, margin: '4px 0 0' }}
                  ellipsis={{ rows: 2 }}
                >
                  {dec.rationale}
                </Typography.Paragraph>
              )}
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
