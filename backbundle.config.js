export default {
        entry: 'src/app.ts',         // 按你的实际入口改
        output: 'dist/src/app.js',
        format: 'cjs',               // 或 'esm'，都可以
        target: 'node18',
        excludePackages: true,                // 不要把 mysql2 放这里
        esbuildOptions: {
          packages: 'bundle',        // 关键：强制把 npm 包打入 bundle
          mainFields: ['module','main'],
          platform: 'node'
        }
      }