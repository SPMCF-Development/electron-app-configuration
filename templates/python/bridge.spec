# PyInstaller recipe for the simulation engine.
# Build it from the project root with:  npm run build:python   (see scripts/build-python.mjs)
#
# Produces python-dist/<os>-<arch>/bridge/ containing bridge.exe (Windows) or bridge
# (macOS/Linux) plus everything it needs, including the Python interpreter and your packages.
#
# The engine name "bridge" (name= in EXE and COLLECT below) must match two other places:
#   - src/main/python.ts       bundledEngine() looks for resources/python/bridge/bridge(.exe)
#   - electron-builder.yml     extraResources copies python-dist/${os}-${arch}/bridge

a = Analysis(
    ["bridge.py"],  # paths here are relative to this .spec file
    pathex=[],
    binaries=[],
    # Non-Python files your script reads at runtime, as (source, folder-inside-bundle) pairs,
    # e.g. datas=[("defaults.xlsx", ".")]. Find them at runtime with Path(__file__).parent.
    datas=[],
    # Modules PyInstaller can't see being imported. pandas loads openpyxl only when it
    # reads an .xlsx, so it must be listed. Add others here if the built engine reports
    # "ModuleNotFoundError".
    hiddenimports=["openpyxl"],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,  # "one-folder" build: starts fast, fewer antivirus false alarms
    name="bridge",
    console=True,  # keep True: Electron talks to it over stdin/stdout. No window appears.
    upx=False,
    debug=False,
    strip=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    upx=False,
    strip=False,
    name="bridge",
)