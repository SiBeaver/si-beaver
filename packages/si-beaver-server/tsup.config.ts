import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/mcp/server.ts',
    'src/mcp/http-server.ts',
    'src/api/server.ts',
  ],
  format: ['esm'],
  dts: !process.env.SKIP_DTS,
  clean: true,
  sourcemap: true,
});
