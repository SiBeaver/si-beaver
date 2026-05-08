import { existsSync } from 'fs';
import { resolve } from 'path';
import { Registry } from './registry.js';

/**
 * 启动时自动迁移：确保 registry.db 存在并注册 default 项目。
 * 幂等——重复调用无副作用。
 */
export function runMigration(basePath: string): void {
  const registryPath = resolve(basePath, 'registry.db');

  // Registry 已存在 → 无需迁移
  if (existsSync(registryPath)) return;

  // 创建 registry 并注册 default 项目
  const registry = new Registry(registryPath);
  try {
    const legacyDb = resolve(basePath, 'projects', 'default', 'cognition.db');
    const hasLegacy = existsSync(legacyDb);

    registry.insertProject({
      slug: 'default',
      name: 'Default Project',
      description: hasLegacy
        ? 'Migrated from single-project setup'
        : '',
    });
  } finally {
    registry.close();
  }
}
