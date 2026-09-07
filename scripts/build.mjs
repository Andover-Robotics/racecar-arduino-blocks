import {build} from 'esbuild';
import {cp, mkdir, rm, readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';

const sveltePlugin = {
  name: 'svelte',
  setup(build) {
    build.onLoad({filter: /\.svelte$/}, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const compiled = compile(source, {
        filename: args.path,
        generate: 'client',
        css: 'injected',
      });
      return {contents: compiled.js.code, loader: 'js', warnings: compiled.warnings};
    });
  },
};

await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/renderer.js',
  sourcemap: true,
  plugins: [sveltePlugin],
});

await cp('src/index.html', 'dist/index.html');
