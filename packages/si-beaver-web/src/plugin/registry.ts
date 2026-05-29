import type { TabPlugin } from './types';

const registry: Map<string, TabPlugin> = new Map();

export function registerPlugin(plugin: TabPlugin): void {
  registry.set(plugin.key, plugin);
}

export function getPlugins(): TabPlugin[] {
  return Array.from(registry.values());
}

export function getPlugin(key: string): TabPlugin | undefined {
  return registry.get(key);
}
