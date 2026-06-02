import { useState, useRef, useEffect } from 'react';
import {
  Row, Col, Input, Tree, Card, Tag, Typography, Skeleton, Alert,
  Drawer, Button, Space, Popconfirm, Form, Select, message, Divider, theme,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  SendOutlined, RobotOutlined, BookOutlined, SaveOutlined,
  PushpinOutlined, PushpinFilled,
} from '@ant-design/icons';
import { StatusBadge } from '../shared/StatusBadge';
import { TimeAgo } from '../shared/TimeAgo';
import { EmptyState } from '../shared/EmptyState';
import {
  fetchKnowledgeTree, distillKnowledge, knowledgeChat, executeOperation, deleteNode,
  type ChatMessage, type KnowledgeTreeNode,
} from '../../api/client';
import useSWR, { useSWRConfig } from 'swr';

const CONFIDENCE_COLORS: Record<string, string> = { high: 'green', medium: 'gold', low: 'orange' };
const CONFIDENCE_LABELS: Record<string, string> = { high: '高置信', medium: '中置信', low: '低置信' };

function useKnowledgeTree(slug: string) {
  return useSWR(`${slug}/knowledge/tree`, () => fetchKnowledgeTree(slug), { refreshInterval: 30_000 });
}

// ============================================================
// Chat Panel
// ============================================================

function ChatPanel({ slug }: { slug: string }) {
  const [messages, setMessages] = useState<(ChatMessage & { reasoning?: string })[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { mutate } = useSWRConfig();
  const { token } = theme.useToken();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const chatMessages = newMessages.map(({ role, content }) => ({ role, content }));
      const res = await knowledgeChat(slug, chatMessages);
      setMessages([...newMessages, { role: 'assistant', content: res.reply, reasoning: res.reasoning || undefined }]);
      if (res.saved.length > 0) {
        message.success(`已保存 ${res.saved.length} 条知识`);
        mutate((key: string) => typeof key === 'string' && key.includes(slug));
      }
    } catch (e: any) {
      message.error(e.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        flex: 1, overflow: 'auto', padding: '12px 0',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: token.colorTextSecondary }}>
            <RobotOutlined style={{ fontSize: 32, marginBottom: 12 }} />
            <div>输入零散需求或想法，我来帮你整理到知识库</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>说"保存"可将整理结果写入知识库</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            {msg.role === 'assistant' && msg.reasoning && (
              <details style={{
                marginBottom: 4, fontSize: 11, color: token.colorTextSecondary,
                background: token.colorFillQuaternary, borderRadius: 8, padding: '4px 8px',
              }}>
                <summary style={{ cursor: 'pointer', userSelect: 'none' }}>思考过程</summary>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, opacity: 0.8 }}>{msg.reasoning}</div>
              </details>
            )}
            <div style={{
              padding: '8px 12px',
              borderRadius: 12,
              background: msg.role === 'user' ? token.colorPrimary : token.colorBgElevated,
              color: msg.role === 'user' ? '#fff' : token.colorText,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              border: msg.role === 'assistant' ? `1px solid ${token.colorBorderSecondary}` : undefined,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '8px 12px' }}>
            <Typography.Text type="secondary">思考中...</Typography.Text>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <Input.TextArea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入需求、想法、零散信息..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ borderRadius: 8 }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={send} loading={loading} />
      </div>
    </div>
  );
}

// ============================================================
// Center Panel: Inline detail + edit
// ============================================================

function KnowledgePanel({ slug, node, onUpdated, onDeselect }: {
  slug: string;
  node: KnowledgeTreeNode;
  onUpdated: () => void;
  onDeselect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    setEditing(false);
  }, [node.id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = form.getFieldsValue();
      await executeOperation(slug, 'update-knowledge', {
        knowledge_id: node.id,
        ...values,
      });
      message.success('已保存');
      setEditing(false);
      onUpdated();
    } catch (e: any) {
      message.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNode(slug, node.id);
      message.success('已删除');
      onDeselect();
      onUpdated();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const handlePin = async () => {
    try {
      await executeOperation(slug, 'pin-knowledge', { knowledge_id: node.id, pinned: !node.pinned });
      message.success(node.pinned ? '已取消固定' : '已固定为锚点');
      onUpdated();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  if (editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Text strong>编辑知识</Typography.Text>
          <Space>
            <Button size="small" onClick={() => setEditing(false)}>取消</Button>
            <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存</Button>
          </Space>
        </div>
        <Form form={form} layout="vertical" initialValues={node} size="small">
          <Form.Item name="title" label="标题"><Input /></Form.Item>
          <Form.Item name="description" label="摘要"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="content" label="内容 (Markdown)">
            <Input.TextArea rows={10} style={{ fontFamily: 'monospace', fontSize: 13 }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="domain" label="领域"><Input /></Form.Item></Col>
            <Col span={8}>
              <Form.Item name="confidence" label="置信度">
                <Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} />
              </Form.Item>
            </Col>
            <Col span={8}><Form.Item name="source" label="来源"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {node.pinned && <PushpinFilled style={{ color: token.colorPrimary }} />}
          <Typography.Title level={5} style={{ margin: 0 }}>{node.title}</Typography.Title>
        </div>
        <Space size={4}>
          <Button
            size="small" type="text"
            icon={node.pinned ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={handlePin}
            title={node.pinned ? '取消固定' : '固定为锚点'}
          />
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditing(true); form.setFieldsValue(node); }} />
          <Popconfirm title="确定删除？" onConfirm={handleDelete}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>
      <Space style={{ marginBottom: 12 }}>
        <StatusBadge status={node.status} />
        <Tag color={CONFIDENCE_COLORS[node.confidence]}>{CONFIDENCE_LABELS[node.confidence]}</Tag>
        <Tag>{node.domain}</Tag>
      </Space>
      {node.description && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 8 }}>{node.description}</Typography.Paragraph>
      )}
      {node.content && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>{node.content}</div>
        </>
      )}
      {!node.content && !node.description && (
        <EmptyState title="暂无内容" description="点击编辑按钮添加内容。" />
      )}
      <Divider style={{ margin: '12px 0' }} />
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        来源: {node.source || '未知'} | 更新于 <TimeAgo date={node.updated_at} />
      </Typography.Text>
      {node.tags.length > 0 && (
        <div style={{ marginTop: 8 }}>{node.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}</div>
      )}
    </div>
  );
}

// ============================================================
// Tree Node Rendering
// ============================================================

function buildTreeData(nodes: KnowledgeTreeNode[], search: string): any[] {
  const q = search.toLowerCase();
  const matchesSearch = (n: KnowledgeTreeNode): boolean => {
    if (!q) return true;
    return n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.tags.some((t: string) => t.toLowerCase().includes(q));
  };

  const filterTree = (items: KnowledgeTreeNode[]): any[] => {
    return items
      .filter(n => matchesSearch(n) || n.children.some(matchesSearch))
      .map(n => ({
        key: n.id,
        title: (
          <span>
            {n.pinned && <PushpinFilled style={{ marginRight: 4, fontSize: 11, opacity: 0.6 }} />}
            {n.title}
            {n.children.length > 0 && <Tag style={{ marginLeft: 6, fontSize: 10 }}>{n.children.length}</Tag>}
          </span>
        ),
        isLeaf: n.children.length === 0,
        children: n.children.length > 0 ? filterTree(n.children) : undefined,
        data: n,
      }));
  };

  return filterTree(nodes);
}

// ============================================================
// Main KnowledgeBase View
// ============================================================

export function KnowledgeBaseView({ slug }: { slug: string }) {
  const { data, error, isLoading, mutate: refetch } = useKnowledgeTree(slug);
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<KnowledgeTreeNode | null>(null);
  const [distillOpen, setDistillOpen] = useState(false);
  const [distillText, setDistillText] = useState('');
  const [distilling, setDistilling] = useState(false);
  const { token } = theme.useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;

  const tree = data?.tree || [];
  const treeData = buildTreeData(tree, search);

  const handleDistill = async () => {
    if (!distillText.trim()) return;
    setDistilling(true);
    try {
      const res = await distillKnowledge(slug, distillText);
      const counts = [
        res.created?.length && `创建 ${res.created.length}`,
        (res as any).updated?.length && `更新 ${(res as any).updated.length}`,
        (res as any).merged?.length && `合并 ${(res as any).merged.length}`,
      ].filter(Boolean).join(', ');
      message.success(`${counts || '完成'}: ${res.summary}`);
      setDistillText('');
      setDistillOpen(false);
      refetch();
    } catch (e: any) {
      message.error(e.message || '蒸馏失败');
    } finally {
      setDistilling(false);
    }
  };

  const handleSelect = (_keys: any, info: any) => {
    if (info.node?.data) {
      setSelectedNode(info.node.data);
    }
  };

  return (
    <Row gutter={16} style={{ height: 'calc(100vh - 130px)' }}>
      {/* Left: Knowledge tree */}
      <Col span={7} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: 8 }}
          />
          <Button icon={<PlusOutlined />} onClick={() => setDistillOpen(true)} title="蒸馏" />
        </div>
        <Card size="small" style={{ flex: 1, overflow: 'auto', borderRadius: 12 }}>
          {treeData.length === 0 ? (
            <EmptyState title="暂无知识" description="使用右侧对话或「+」按钮添加知识。" />
          ) : (
            <Tree
              treeData={treeData}
              defaultExpandAll
              onSelect={handleSelect}
              style={{ fontSize: 13 }}
              blockNode
            />
          )}
          <div style={{ padding: '12px 0', borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              <BookOutlined /> {data?.total || 0} 条知识 | <PushpinFilled /> = 锚点（人工固定）
            </Typography.Text>
          </div>
        </Card>
      </Col>

      {/* Center: Content detail/edit */}
      <Col span={9} style={{ height: '100%' }}>
        <Card size="small" style={{ height: '100%', overflow: 'auto', borderRadius: 12 }}>
          {selectedNode ? (
            <KnowledgePanel
              slug={slug}
              node={selectedNode}
              onUpdated={() => { refetch(); }}
              onDeselect={() => setSelectedNode(null)}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: token.colorTextSecondary }}>
              <BookOutlined style={{ fontSize: 36, marginBottom: 12 }} />
              <div>选择左侧知识条目查看详情</div>
            </div>
          )}
        </Card>
      </Col>

      {/* Right: Chat panel */}
      <Col span={8} style={{ height: '100%' }}>
        <Card
          size="small"
          title={<><RobotOutlined /> 知识助手</>}
          style={{ height: '100%', borderRadius: 12, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 12px 12px' } }}
        >
          <ChatPanel slug={slug} />
        </Card>
      </Col>

      {/* Distill drawer */}
      <Drawer
        title="知识蒸馏"
        open={distillOpen}
        onClose={() => setDistillOpen(false)}
        width={500}
        extra={<Button type="primary" loading={distilling} onClick={handleDistill}>提取知识</Button>}
      >
        <Typography.Paragraph type="secondary">
          粘贴零散文本、会议记录、需求描述等，AI 将自动提取、合并、归类到知识库中。
        </Typography.Paragraph>
        <Input.TextArea
          value={distillText}
          onChange={e => setDistillText(e.target.value)}
          rows={15}
          placeholder="粘贴文本内容..."
          style={{ borderRadius: 8 }}
        />
      </Drawer>
    </Row>
  );
}
