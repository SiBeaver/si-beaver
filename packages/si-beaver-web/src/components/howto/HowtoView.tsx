import { Typography, Card, Tag, Steps } from 'antd';
import {
  QuestionCircleOutlined,
  UserOutlined,
  CodeOutlined,
  TeamOutlined,
  AimOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  BookOutlined,
  WarningOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

interface Props {
  slug: string;
}

const ROLE_PATHS = [
  {
    role: '新人',
    icon: <UserOutlined />,
    color: 'green',
    description: '刚加入项目，需要快速理解项目是什么、当前状态、关键决策。',
    steps: [
      { title: '① 是什么', description: '阅读项目宪法级简介，理解核心定位和边界' },
      { title: '② 设计', description: '浏览架构快照，理解已接受的关键决策及其理由' },
      { title: '③ 目标', description: '查看路线图，了解项目方向与当前目标' },
      { title: '④ 任务', description: '浏览任务看板，找到可以参与的工作' },
    ],
  },
  {
    role: '开发者',
    icon: <CodeOutlined />,
    color: 'blue',
    description: '需要了解当前任务、阻塞项、相关决策背景，高效推进开发。',
    steps: [
      { title: '④ 任务', description: '查看任务看板，关注进行中和阻塞项' },
      { title: '③ 目标', description: '点击目标节点查看因果链，了解任务背后的 context' },
      { title: '② 设计', description: '查阅架构决策快照，确保实现对齐已接受的设计' },
      { title: '⑤ 怎么用', description: '通过 MCP 工具与 AI 协作，操作认知图谱' },
    ],
  },
  {
    role: 'PM / Leader',
    icon: <TeamOutlined />,
    color: 'purple',
    description: '需要把握项目全局进度、关键风险、技术债和决策质量。',
    steps: [
      { title: '③ 目标', description: '查看路线图进度，关注阻塞项和废弃目标' },
      { title: '④ 任务', description: '浏览任务看板，评估资源分布和瓶颈' },
      { title: '② 设计', description: '审查架构快照，确认决策收敛和一致性' },
      { title: '① 是什么', description: '维护项目宪法级简介，确保定位准确' },
    ],
  },
];

const MCP_GROUPS = [
  {
    group: '目标 (Goals)',
    icon: <AimOutlined />,
    color: 'blue',
    tools: [
      { name: 'define_goal', desc: '定义项目目标，设定时间范围和优先级' },
      { name: 'decompose_goal', desc: '将目标分解为子目标和任务' },
      { name: 'update_goal_status', desc: '更新目标状态 (active/achieved/abandoned)' },
      { name: 'get_roadmap', desc: '获取目标路线图，支持层级展开' },
      { name: 'goal_progress', desc: '查看所有活跃目标的进度' },
    ],
  },
  {
    group: '任务 (Tasks)',
    icon: <UnorderedListOutlined />,
    color: 'green',
    tools: [
      { name: 'create_task', desc: '创建具体任务，绑定父目标和验收标准' },
      { name: 'update_task_status', desc: '更新任务状态 (proposed→done)' },
      { name: 'get_task_context', desc: '获取任务上下文：父目标、关联决策' },
    ],
  },
  {
    group: '决策 (Decisions)',
    icon: <CheckCircleOutlined />,
    color: 'gold',
    tools: [
      { name: 'record_decision', desc: '记录架构/设计决策，含备选方案和后果' },
      { name: 'decision_trail', desc: '追溯决策链：从某个节点出发查看关联决策' },
    ],
  },
  {
    group: '知识 (Knowledge)',
    icon: <BookOutlined />,
    color: 'geekblue',
    tools: [
      { name: 'record_knowledge', desc: '记录项目知识，含置信度和来源' },
      { name: 'knowledge_map', desc: '按领域查看知识图谱' },
      { name: 'full_text_search', desc: '全文搜索所有节点' },
    ],
  },
  {
    group: '风险 (Risks)',
    icon: <WarningOutlined />,
    color: 'red',
    tools: [
      { name: 'identify_risk', desc: '识别项目风险，评估影响和可能性' },
      { name: 'update_risk', desc: '更新风险状态 (identified→mitigated)' },
      { name: 'current_blockers', desc: '查找当前阻塞项' },
    ],
  },
  {
    group: '投影 (Projections)',
    icon: <FileTextOutlined />,
    color: 'cyan',
    tools: [
      { name: 'generate_projection', desc: '从语义节点生成 Markdown 投影文档' },
      { name: 'list_projections', desc: '列出可用投影类型' },
    ],
  },
  {
    group: '探索 & 图谱',
    icon: <QuestionCircleOutlined />,
    color: 'purple',
    tools: [
      { name: 'begin_exploration', desc: '开始探索性调查' },
      { name: 'conclude_exploration', desc: '结论化探索，产出决策/知识/任务' },
      { name: 'get_node_context', desc: '获取节点完整上下文（边+邻居+事件）' },
      { name: 'link_nodes', desc: '在两个节点间建立语义关系' },
      { name: 'recent_activity', desc: '查看最近事件' },
      { name: 'stale_items', desc: '查找长期未更新的活跃节点' },
    ],
  },
];

export function HowtoView({ slug: _slug }: Props) {
  return (
    <div style={{ maxWidth: 960 }}>
      <Typography.Title level={4}>⑤ 怎么用</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>
        sibeaver 是人机共识的交接点。以下为不同角色的推荐阅读路径和 MCP 工具速查。
      </Typography.Paragraph>

      {/* Role paths */}
      <Typography.Title level={5} style={{ marginBottom: 16 }}>角色阅读路径</Typography.Title>
      {ROLE_PATHS.map(r => (
        <Card
          key={r.role}
          size="small"
          title={
            <span>
              <Tag color={r.color} icon={r.icon}>{r.role}</Tag>
              {r.description}
            </span>
          }
          style={{ borderRadius: 10, marginBottom: 16 }}
        >
          <Steps
            size="small"
            direction="horizontal"
            items={r.steps.map(s => ({ title: s.title, description: s.description }))}
          />
        </Card>
      ))}

      {/* MCP tools */}
      <Typography.Title level={5} style={{ marginTop: 32, marginBottom: 16 }}>MCP 工具分类</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        通过 MCP 连接 sibeaver 后，以下 ~30 个工具可直接在 AI 对话中使用。
        端点: <Typography.Text code>http://sibs.realhyx.local/mcp/{'{project-slug}'}</Typography.Text>
      </Typography.Paragraph>

      {MCP_GROUPS.map(g => (
        <Card
          key={g.group}
          size="small"
          title={
            <span>
              <Tag color={g.color} icon={g.icon}>{g.group}</Tag>
            </span>
          }
          style={{ borderRadius: 10, marginBottom: 12 }}
          styles={{ body: { padding: '8px 16px' } }}
        >
          {g.tools.map(t => (
            <div key={t.name} style={{ padding: '5px 0', display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <Typography.Text code style={{ minWidth: 160, fontSize: 12 }}>{t.name}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>{t.desc}</Typography.Text>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
