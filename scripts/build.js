import * as esbuild from 'esbuild'
import { compile, preprocess } from 'svelte/compiler'
import { transform } from 'esbuild'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(rootDir, 'dist')

/** 内联 Svelte 编译插件 */
function sveltePlugin() {
    return {
        name: 'svelte',
        setup(build) {
            build.onResolve({ filter: /\.svelte$/ }, (args) => ({
                path: path.isAbsolute(args.path)
                    ? args.path
                    : path.resolve(args.resolveDir, args.path),
                namespace: 'file',
            }))

            build.onLoad({ filter: /\.svelte$/ }, async (args) => {
                const source = fs.readFileSync(args.path, 'utf-8')
                const filename = args.path

                const preprocessed = await preprocess(
                    source,
                    [
                        {
                            script: async ({ content, attributes }) => {
                                if (attributes.lang !== 'ts') return
                                const result = await transform(content, {
                                    loader: 'ts',
                                    tsconfigRaw: '{ "compilerOptions": { "verbatimModuleSyntax": true } }',
                                })
                                return { code: result.code }
                            },
                        },
                    ],
                    { filename },
                )

                const compiled = compile(preprocessed.code, {
                    filename,
                    generate: 'client',
                    css: 'injected',
                    runes: true,
                    dev: false,
                })

                for (const w of compiled.warnings) {
                    if (w.code?.startsWith('a11y_') || w.code === 'state_referenced_locally') continue
                    console.warn(`[svelte] ${filename}: ${w.message}`)
                }

                return {
                    contents: compiled.js.code,
                    loader: 'js',
                    resolveDir: path.dirname(args.path),
                }
            })
        },
    }
}

// 共享配置
const shared = {
    entryPoints: [path.resolve(rootDir, 'src/index.ts')],
    bundle: true,
    external: ['svelte', 'svelte/*'],
    plugins: [sveltePlugin()],
    target: 'esnext',
    minify: true,
}

// 清空 dist
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

// ESM
await esbuild.build({
    ...shared,
    format: 'esm',
    outfile: path.resolve(outDir, 'svelte-html-router.mjs'),
})

// CJS
await esbuild.build({
    ...shared,
    format: 'cjs',
    outfile: path.resolve(outDir, 'svelte-html-router.cjs'),
})

// 复制类型声明
const srcDir = path.resolve(rootDir, 'src')
const typesDir = path.resolve(outDir, 'types')
fs.mkdirSync(typesDir, { recursive: true })
for (const f of fs.readdirSync(srcDir)) {
    if (f.endsWith('.ts')) {
        fs.copyFileSync(path.resolve(srcDir, f), path.resolve(typesDir, f))
    }
}

console.log('✅ svelte-html-router 构建完成')
for (const f of fs.readdirSync(outDir)) {
    if (f === 'types') continue
    const stat = fs.statSync(path.resolve(outDir, f))
    console.log(`  ${f}: ${(stat.size / 1024).toFixed(1)} KB`)
}
