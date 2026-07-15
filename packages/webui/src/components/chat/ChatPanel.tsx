import { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, message, theme } from 'antd';
import { SendOutlined, RobotOutlined } from '@ant-design/icons';
import { knowledgeChat, type ChatMessage } from '../../api/client';
import { useSWRConfig } from 'swr';

interface Props {
  slug: string;
}

export function ChatPanel({ slug }: Props) {
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
            <div>有什么需要我帮忙的？</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>输入想法、问题或指令</div>
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
          placeholder="输入想法、问题或指令..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ borderRadius: 8 }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={send} loading={loading} />
      </div>
    </div>
  );
}
