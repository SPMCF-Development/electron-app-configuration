// Builds the bundled Python engine with PyInstaller for the machine it runs on.
//
// Output: python-dist/<os>-<arch>/bridge/        (the engine folder that gets packaged)
//         python-dist/<os>-<arch>/engine-info.json (what it was built with)
//
// <os> and <arch> use electron-builder's names (win | mac | linux, x64 | arm64 | ia32) and come
// from the Python interpreter itself, so an x64 Python running under emulation on an Apple
// Silicon Mac is correctly labelled mac-x64. scripts/before-pack.mjs relies on these names.
//
// Uses python/.venv by default, or PYTHON_EXECUTABLE if set.  Run via:  npm run build:python
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pythonDir = join(root, 'python')

/** Prints an error and stops the build. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- plain JS file, no type annotations
function fail(...lines) {
  for (const line of lines) console.error(line)
  process.exit(1)
}

// 1. Find Python.
const venvPython =
  process.platform === 'win32'
    ? join(pythonDir, '.venv', 'Scripts', 'python.exe')
    : join(pythonDir, '.venv', 'bin', 'python')
const python = process.env.PYTHON_EXECUTABLE || venvPython

if (!process.env.PYTHON_EXECUTABLE && !existsSync(venvPython)) {
  fail(
    `No Python found at ${venvPython}.`,
    'Create python/.venv with your packages and pyinstaller installed, or set PYTHON_EXECUTABLE.'
  )
}

// 2. Ask that Python what it is, and confirm PyInstaller is installed.
const probe = spawnSync(
  python,
  [
    '-c',
    'import json, platform, sys, importlib.util as u; print(json.dumps({' +
      '"platform": sys.platform, "machine": platform.machine(), ' +
      '"version": platform.python_version(), ' +
      '"pyinstaller": u.find_spec("PyInstaller") is not None}))'
  ],
  { encoding: 'utf8' }
)
if (probe.error || probe.status !== 0) {
  fail(`Couldn't run ${python}.`, probe.error?.message ?? probe.stderr)
}
const info = JSON.parse(probe.stdout)

if (!info.pyinstaller) {
  fail(
    `PyInstaller isn't installed for ${python}.`,
    'Install it with:  <that python> -m pip install pyinstaller'
  )
}

const OS_NAMES = { win32: 'win', darwin: 'mac', linux: 'linux' }
const ARCH_NAMES = {
  amd64: 'x64',
  x86_64: 'x64',
  arm64: 'arm64',
  aarch64: 'arm64',
  x86: 'ia32',
  i386: 'ia32',
  i686: 'ia32'
}
const os = OS_NAMES[info.platform]
const arch = ARCH_NAMES[info.machine.toLowerCase()]
if (!os || !arch) fail(`Unsupported platform for packaging: ${info.platform} / ${info.machine}`)

const target = `${os}-${arch}`
const distDir = join(root, 'python-dist', target)
console.log(`Building the Python engine for ${target} with Python ${info.version}...`)

// 3. Run PyInstaller. Each target gets its own work folder so builds for different
//    architectures on the same machine don't share stale cache files.
const result = spawnSync(
  python,
  [
    '-m',
    'PyInstaller',
    'bridge.spec',
    '--noconfirm',
    '--clean',
    '--distpath',
    distDir,
    '--workpath',
    join(root, 'build', 'pyinstaller', target)
  ],
  { cwd: pythonDir, stdio: 'inherit' }
)
if (result.error) fail(result.error.message)
if (result.status !== 0) process.exit(result.status ?? 1)

// 4. Record what was built, for the pre-packaging check and for troubleshooting later.
writeFileSync(
  join(distDir, 'engine-info.json'),
  JSON.stringify(
    { os, arch, pythonVersion: info.version, builtAt: new Date().toISOString() },
    null,
    2
  ) + '\n'
)
console.log(`Engine ready: python-dist/${target}/bridge`)