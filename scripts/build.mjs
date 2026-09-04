import {build} from 'esbuild';
import {cp, mkdir, rm} from 'node:fs/promises';

await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/renderer.js',
  sourcemap: true,
});

await cp('src/index.html', 'dist/index.html');
