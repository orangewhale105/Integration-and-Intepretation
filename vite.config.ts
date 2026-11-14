import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Service Worker を出力する。初回の読み込みだけでオフラインで動くよう、
 * ビルドしたすべてのファイルを事前に保存する一覧を埋め込む。
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync('public');
      const files = ['./', './index.html', ...Object.keys(bundle).map((f) => `./${f}`), ...publicFiles.map((f) => `./${f}`)];
      const source = readFileSync(join('sw', 'sw.template.js'), 'utf8')
        .replace('__BUILD_ID__', Date.now().toString(36))
        .replace('__PRECACHE__', JSON.stringify([...new Set(files)], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// GitHub Pages のサブパスでも動くよう、相対パスで出力する
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  plugins: [serviceWorker()],
  test: { environment: 'jsdom' },
});
