const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const cacheRoot = path.join(os.tmpdir(), '.cache', 'prisma');
const homeRoot = os.tmpdir();
const sourceCache = path.join(os.homedir(), '.cache', 'prisma');

function ensureWritableCache() {
  fs.mkdirSync(cacheRoot, { recursive: true });

  if (!fs.existsSync(sourceCache)) {
    return;
  }

  const targetMarker = path.join(cacheRoot, '.source');
  if (fs.existsSync(targetMarker)) {
    return;
  }

  try {
    fs.cpSync(sourceCache, cacheRoot, { recursive: true });
  } catch {
    // If the existing cache cannot be copied, Prisma will fall back to the
    // writable cache path and download what it needs.
  }
}

ensureWritableCache();

const prismaBin = path.resolve(
  projectRoot,
  '../../node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js',
);

const result = spawnSync(
  process.execPath,
  [prismaBin, 'generate', '--postinstall', 'manual', '--schema', 'prisma/schema.prisma'],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOME: homeRoot,
      XDG_CACHE_HOME: homeRoot,
      INIT_CWD: projectRoot,
      npm_lifecycle_event: 'postinstall',
      PRISMA_GENERATE_IN_POSTINSTALL: projectRoot,
    },
    stdio: 'inherit',
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
