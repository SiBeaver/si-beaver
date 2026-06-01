import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: !process.env.SKIP_DTS,
  sourcemap: true,
  clean: false,
  noExternal: [/.*/],
  external: ['node:*'],
  splitting: false,
});
