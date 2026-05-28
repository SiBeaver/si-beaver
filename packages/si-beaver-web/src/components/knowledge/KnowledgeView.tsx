import { useState } from 'react';
import { Collapse, Tag, Typography, Skeleton, Alert, Input, theme, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useKnowledgeMap } from '../../hooks/useKnowledgeMap';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';
import type { CognitiveNode } from '../../lib/types';

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'green',
  medium: 'gold',
  low: 'orange',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
};

function KnowledgeItem({ node }: { node: CognitiveNode }) {
  const { token } = theme.useToken();

  return (
    <div style={{
      padding: '14px 0',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Typography.Text strong style={{ flex: 1 }}>
          {node.status === 'outdated' ? (
            <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{node.title}</span>
          ) : node.title}
        </Typography.Text>
        {node.confidence && (
          <Tag color={CONFIDENCE_COLORS[node.confidence]}>{CONFIDENCE_LABELS[node.confidence]}</Tag>
        )}
        <StatusBadge status={node.status} />
      </div>
      {node.description && (
        <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }} ellipsis={{ rows: 3, expandable: 'collapsible' }}>
          {node.description}
        </Typography.Paragraph>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        {node.source && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            来源: {node.source}
          </Typography.Text>
        )}
        <TimeAgo date={node.updatedAt} />
        {node.tags.length > 0 && (
          <Space size={4}>
            {node.tags.slice(0, 3).map(t => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
          </Space>
        )}
      </div>
    </div>
  );
}

export function KnowledgeView({ slug }: { slug: string }) {
  const { data, error, isLoading } = useKnowledgeMap(slug);
  const [search, setSearch] = useState('');
  const { token } = theme.useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;
  if (!data) return <EmptyState title="暂无知识" description="通过 MCP 记录知识后将在此显示。" />;

  const domains = Object.entries(data.byDomain);
  if (domains.length === 0) {
    return <EmptyState title="暂无知识" description="通过 MCP 记录知识后将在此显示。" />;
  }

  // Filter by search
  const filteredDomains = search.trim()
    ? domains
        .map(([domain, items]) => [
          domain,
          items.filter(n =>
            n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.description.toLowerCase().includes(search.toLowerCase()) ||
            n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
          ),
        ] as [string, CognitiveNode[]])
        .filter(([, items]) => items.length > 0)
    : domains;

  const totalCount = data.knowledge.length;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Input
          prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
          placeholder="搜索知识..."
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320, borderRadius: 8 }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          共 {totalCount} 条知识，{domains.length} 个领域
        </Typography.Text>
      </div>

      {filteredDomains.length === 0 ? (
        <EmptyState title="无匹配结果" description="尝试其他搜索关键词。" />
      ) : (
        <Collapse
          defaultActiveKey={filteredDomains.slice(0, 3).map(([d]) => d)}
          style={{ background: 'transparent', border: 'none' }}
          items={filteredDomains.map(([domain, items]) => ({
            key: domain,
            label: (
              <span style={{ fontWeight: 500 }}>
                {domain}
                <Tag style={{ marginLeft: 8 }}>{items.length}</Tag>
              </span>
            ),
            children: (
              <div>
                {items.map(node => (
                  <KnowledgeItem key={node.id} node={node} />
                ))}
              </div>
            ),
            style: {
              marginBottom: 12,
              borderRadius: 12,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
            },
          }))}
        />
      )}
    </div>
  );
}
