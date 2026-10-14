// electron-builder runs this just before packaging each platform/architecture (see
// "beforePack" in electron-builder.yml). It stops the build with a clear message if there is
// no Python engine for the target being packaged, instead of producing an installer whose
// Run button fails on users' machines.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OS_NAMES = { win32: 'win', darwin: 'mac', linux: 'linux' }
// electron-builder's internal architecture numbers.
const ARCH_NAMES = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- plain JS file, no type annotations
export default async function beforePack(context) {
  const os = OS_NAMES[context.electronPlatformName] ?? context.electronPlatformName
  const arch = ARCH_NAMES[context.arch] ?? String(context.arch)
  const target = `${os}-${arch}`

  if (arch === 'universal') {
    throw new Error(
      'Universal macOS builds are not supported: the Python engine is built for one ' +
        'architecture. Package arm64 and x64 separately (npm run dist -- --arm64, then -- --x64).'
    )
  }

  const distRoot = join(context.packager.projectDir, 'python-dist')
  const engineDir = join(distRoot, target, 'bridge')
  const infoFile = join(distRoot, target, 'engine-info.json')

  if (!existsSync(engineDir) || !existsSync(infoFile)) {
    const available = existsSync(distRoot)
      ? readdirSync(distRoot).filter((d) => existsSync(join(distRoot, d, 'engine-info.json')))
      : []
    throw new Error(
      `No Python engine for ${target}. ` +
        (available.length
          ? `Engines found: ${available.join(', ')}. `
          : 'No engines have been built yet. ') +
        `Run "npm run build:python" on a ${target} machine with a ${arch} Python, ` +
        'or package for an architecture that has an engine (for example: npm run dist -- --x64).'
    )
  }

  const info = JSON.parse(readFileSync(infoFile, 'utf8'))
  if (info.os !== os || info.arch !== arch) {
    throw new Error(
      `python-dist/${target} contains an engine built for ${info.os}-${info.arch}. ` +
        'Delete the python-dist folder and run "npm run build:python" again.'
    )
  }

  console.log(
    `  • Python engine   target=${target} python=${info.pythonVersion} built=${info.builtAt}`
  )
}