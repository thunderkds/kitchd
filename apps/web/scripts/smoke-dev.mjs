// T051 regression check: `vite` dev must serve @kitchenos/shared as something
// the browser can import. shared compiles to CommonJS; if Vite serves it raw
// over /@fs/ the browser throws "does not provide an export named ..." and the
// app never mounts. vitest and `vite build` both cope with CJS, so only a real
// dev server run catches this.
import { createServer } from 'vite'

const SYMBOL = 'createSessionStore'
const ENTRY = '/src/routes/auth.ts' // imports SYMBOL from @kitchenos/shared at runtime

const server = await createServer({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname,
  server: { port: 0, strictPort: false },
  logLevel: 'error',
})

let failure = null
try {
  await server.listen()
  const base = server.resolvedUrls.local[0].replace(/\/$/, '')
  const get = async (path) => {
    const res = await fetch(base + path)
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`)
    return res.text()
  }

  // What the browser receives for the importer, after Vite's import rewriting.
  const importer = await get(ENTRY)
  const named = importer.match(
    new RegExp(`import\\s*\\{[^}]*\\b${SYMBOL}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`),
  )
  // Pre-bundled CJS deps are rewritten to a default import + property access.
  const interopVar = importer.match(new RegExp(`(\\w+)\\["${SYMBOL}"\\]`))?.[1]
  const interop = interopVar
    ? importer.match(new RegExp(`import\\s+${interopVar}\\s+from\\s*"([^"]+)"`))
    : null
  const url = (named ?? interop)?.[1]
  if (!url) throw new Error(`${ENTRY} does not import ${SYMBOL} from @kitchenos/shared`)

  // What the browser receives for the shared module itself.
  const dep = await get(url)
  const hasNamedExport = new RegExp(`export\\s*\\{[^}]*\\b${SYMBOL}\\b|export\\s+(const|function)\\s+${SYMBOL}\\b`).test(dep)
  const hasDefaultExport = /export\s*\{[^}]*\bas\s+default\b|export\s+default\b/.test(dep)
  const ok = named ? hasNamedExport : hasDefaultExport
  if (!ok) {
    throw new Error(
      `${url} is not importable as ESM (no ${named ? `export of ${SYMBOL}` : 'default export'}) — ` +
        'CommonJS served raw; the browser would throw "does not provide an export named"',
    )
  }
  console.log(`ok: ${ENTRY} -> ${url} is importable as ESM`)
} catch (err) {
  failure = err
} finally {
  await server.close()
}

if (failure) {
  console.error(`smoke:dev FAILED: ${failure.message}`)
  process.exit(1)
}
