import type { ComponentType } from 'react';

export interface TabPlugin {
  key: string;
  label: string;
  icon: ComponentType;
  component: ComponentType<{ slug: string }>;
}
