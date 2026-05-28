import { useState } from 'react';
import { Typography, Button, Card, Skeleton, Alert, Modal, Input, Tag, Space } from 'antd';
import { EditOutlined, InfoCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import useSWR, { useSWRConfig } from 'swr';
import { fetchProject, updateProject } from '../../api/client';
import { EmptyState } from '../shared/EmptyState';

interface Props {
  slug: string;
}

export function WhatView({ slug }: Props) {
  const { data: project, error, isLoading } = useSWR(`project:${slug}`, () => fetchProject(slug));
  const { mutate } = useSWRConfig();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setDraft(project?.description ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProject(slug, { description: draft });
      mutate(`project:${slug}`);
      setEditing(false);
    } catch (e: any) {
      // keep modal open, error shown by alert
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (error) return <Alert type="error" message="加载失败" description={error.message} showIcon />;

  const description = project?.description ?? '';

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>① 是什么</Typography.Title>
        <Tag color="default" icon={<InfoCircleOutlined />} style={{ margin: 0 }}>
          宪法级 · 仅由人维护
        </Tag>
      </div>

      <Card
        style={{ borderRadius: 12 }}
        styles={{ body: { padding: 24 } }}
        extra={
          <Button type="text" icon={<EditOutlined />} onClick={handleEdit}>
            编辑
          </Button>
        }
      >
        {description ? (
          <Typography.Paragraph
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: 15,
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            {description}
          </Typography.Paragraph>
        ) : (
          <EmptyState
            title="尚未编写项目简介"
            description="描述这个项目的核心定位、边界和宪法级原则。此内容不会由 AI 自动生成，仅由人维护。"
          />
        )}
      </Card>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            编辑项目简介
            <Tag color="warning" style={{ marginLeft: 8 }}>宪法级内容</Tag>
          </Space>
        }
        open={editing}
        onOk={handleSave}
        onCancel={() => setEditing(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Alert
          type="warning"
          showIcon
          message="宪法级——仅由人维护"
          description="项目简介是项目的宪法级定位声明，永远不会被 AI 自动生成或修改。请谨慎编辑，确保内容始终反映人的意图。"
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={10}
          placeholder={'描述这个项目的核心定位、边界和宪法级原则。\n\n例如：\n- 这个项目是什么？不做什么？\n- 核心设计原则（宪法级约束）\n- 与其他系统的关系'}
        />
      </Modal>
    </div>
  );
}
