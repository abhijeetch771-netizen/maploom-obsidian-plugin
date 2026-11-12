import esbuild from 'esbuild';
import process from 'process';
import { resolve } from 'node:path';

const production = process.argv[2] === 'production';

const htmlClientPlugin = {
  name: 'maploom-html-client',
  setup(build) {
    build.onResolve(
      { filter: /^virtual:maploom-html-client$/ },
      () => ({ path: 'html-client', namespace: 'maploom-html-client' }),
    );

    build.onLoad(
      { filter: /.*/, namespace: 'maploom-html-client' },
      async () => {
        const result = await esbuild.build({
          entryPoints: ['src/export/html-client.ts'],
          bundle: true,
          write: false,
          format: 'iife',
          platform: 'browser',
          target: 'es2018',
          minify: production,
          sourcemap: false,
          metafile: true,
          logLevel: 'silent',
        });

        const script = result.outputFiles[0].text;
        const watchFiles = Object.keys(result.metafile?.inputs ?? {})
          .map((input) => resolve(input));

        return {
          contents: 'export default ' + JSON.stringify(script) + ';',
          loader: 'js',
          watchFiles,
        };
      },
    );
  },
};

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: production,
  plugins: [htmlClientPlugin],
});

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
  console.log('Maploom: watching for changes');
}
