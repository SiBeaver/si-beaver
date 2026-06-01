import { registerPlugin } from '@si-beaver/web/plugin';
import {
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { WorkflowsView } from './views/WorkflowsView';
import { ToolsView } from './views/ToolsView';

registerPlugin({
  key: 'workflows',
  label: '工作流',
  icon: ThunderboltOutlined,
  component: WorkflowsView,
});

registerPlugin({
  key: 'tools',
  label: '工具箱',
  icon: ToolOutlined,
  component: ToolsView,
});
