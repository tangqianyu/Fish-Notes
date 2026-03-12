import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
      output: {
        banner: `if (require('electron').app.isPackaged && process.resourcesPath) {
  const _M = require('module'), _p = require('path'), _orig = _M._resolveFilename;
  const _natives = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
  _M._resolveFilename = function(request, parent, isMain, options) {
    if (_natives.includes(request)) {
      return _orig.call(this, _p.join(process.resourcesPath, request), parent, isMain, options);
    }
    return _orig.call(this, request, parent, isMain, options);
  };
}`,
      },
    },
  },
});
