export const VERSION = '27.0.0';

export * from '@si-beaver/core';
export * from './storage/index.js';
export * from './operations/index.js';
export * from './projections/index.js';
export * from './embedding/index.js';
export { ProjectManager } from './projects/manager.js';
export type { ProjectMeta, CreateProjectInput, UpdateProjectInput } from './projects/types.js';
