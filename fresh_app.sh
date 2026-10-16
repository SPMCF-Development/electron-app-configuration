#!/bin/bash

set -euo pipefail

echo "Building the workspace for a new Electron app."
echo "This app uses electron-vite alongside React, shadcn/ui, and Tailwind CSS."
echo "The backend defaults to Python that is packaged into the final application. Adjust as needed."

# Import .env file for custom variables
set -a; source fresh_app.env; set +a

# set_var_css <block-start> <var-name> <new-value> <css-path>
set_var_css() {
  local block="$1" name="$2" value="$3" css="$4"
  sed -i.bak -E "/${block}/,/^}/ s|^([[:space:]]*--${name}:)[^;]*;|\1 ${value};|" "${css}"
}

# set_fontsource <package-name> <css-path>
set_fontsource() {
  local package="$1" css="$2"
  sed -i.bak -E "s|^@import [\"']@fontsource-variable/[^\"']+[\"']|@import \"@fontsource-variable/${package}\"|" "${css}"
}

# Build custom variables
MAIN="src/main"
PRELOAD="src/preload"
RENDERER="src/renderer/src"
COMPONENTS="src/renderer/src/components"
SHARED="src/shared"
ASSETS="src/renderer/src/assets"

TEMP_MAIN="$TEMPLATE_FILES_DIR/$MAIN"
TEMP_PRELOAD="$TEMPLATE_FILES_DIR/$PRELOAD"
TEMP_RENDERER="$TEMPLATE_FILES_DIR/$RENDERER"
TEMP_COMPONENTS="$TEMPLATE_FILES_DIR/$COMPONENTS"
TEMP_SHARED="$TEMPLATE_FILES_DIR/$SHARED"

AUTHOR_JSON=$(printf '{"name": "%s", "email": "%s", "url": "%s"}' "$AUTHOR_NAME", "$AUTHOR_EMAIL", "$AUTHOR_URL")

# Build the base project
# Review process for severe vulnerabilities
npm create @quick-start/electron@latest $PROJECT_NAME -- --template react-ts
cd $PROJECT_NAME
npm install

# Identify electron-builder version for use later
EB_VERSION=$(node -p "require('electron-builder/package.json').version")
EB_MAJOR=${EB_VERSION%%.*}

# Install Tailwind CSS
npm install tailwindcss @tailwindcss/vite

# Enable plugin
cp "$TEMPLATE_FILES_DIR/electron.vite.config.ts" ./

# Notify TypeScript of src/shared folder
cp "$TEMPLATE_FILES_DIR/tsconfig.web.json" ./
cp "$TEMPLATE_FILES_DIR/tsconfig.node.json" ./

# Fix the path alias for shadcn/ui (already handled for tsconfig.web.json)
cp "$TEMPLATE_FILES_DIR/tsconfig.json" ./

# Delete base.css and main.css assets, recreate main.css with single line
rm "$ASSETS/base.css"
rm "$ASSETS/main.css"
cat << 'EOF' > "$ASSETS/main.css"
@import "tailwindcss";
EOF

# Initialize shadcn/ui
echo "export default {}" > vite.config.ts # > overwrites
npx shadcn@latest init
rm vite.config.ts

# Modify the package.json file
npm pkg set \
  name="$NAME" \
  productName="$PRODUCT_NAME" \
  version="$VERSION" \
  description="$DESCRIPTION" \
  homepage="$HOMEPAGE"

npm pkg set \
  author="$AUTHOR_JSON" --json

npm pkg delete \
  scripts.build:unpack \
  scripts.build:win \
  scripts.build:mac \
  scripts.build:linux

npm pkg set \
  scripts.build:python="node scripts/build-python.mjs" \
  scripts.dist="npm run build:python && npm run build && electron-builder" \
  scripts.dist:dir="npm run build:python && npm run build && electron-builder --dir"

# Update .gitignore for newer files
cp "$TEMPLATE_FILES_DIR/gitignore" ./.gitignore

# Create scripts folder and build-python.mjs as well as build-pack.mjs
mkdir scripts
cp "$TEMPLATE_FILES_DIR/scripts/build-python.mjs" ./scripts/
cp "$TEMPLATE_FILES_DIR/scripts/build-pack.mjs" ./scripts/

# Update electron-builder.yml file, dependent on current electron-builder version number
cat << EOF > electron-builder.yml
# The app's display name lives in package.json ("productName") so that development and the
# installed app use the same name for their data folders. Change appId to something unique
# to you, in reverse-domain style.
appId: $APP_ID
directories:
  buildResources: build
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
  # Development-only Python files. The packaged app uses the Pyinstaller build instead.
  - '!python/**'
  - '!python-dist/**'
  - '!scripts/**'
asarUnpack:
  - resources/**
# Stops packaging with a clear message if no Python engine exists for the target.
beforePack: scripts/before-pack.mjs
# Copies the engine built for this OS and architecture (e.g., python-dist/win-x64/bridge)
# to <install dir>/resources/python/bridge. Keep "to" the same on every platform:
# src/main/python.ts expects the engine at resources/python/bridge.
extraResources:
  - from: python-dist/\${os}-\${arch}/bridge
    to: python/bridge
EOF
if [ "$EB_MAJOR" -ge 27 ]; then
  cat << EOF >> electron-builder.yml # >> appends
win:
  executableName: $WINDOWS_EXECUTABLE_NAME
  sign:
    type: azure
    publisherName: $AZURE_PUBLISHER_NAME
    endpoint: $AZURE_ENDPOINT
    certificateProfileName: $AZURE_PROFILE_NAME
    codeSigningAccountName: $AZURE_ACCOUNT_NAME
EOF
else
  cat << EOF >> electron-builder.yml
  azureSignOptions:
    publisherName: $AZURE_PUBLISHER_NAME
    endpoint: $AZURE_ENDPOINT
    certificateProfileName: $AZURE_PROFILE_NAME
    codeSigningAccountName: $AZURE_ACCOUNT_NAME
EOF
fi
cat << EOF >> electron-builder.yml
nsis:
  artifactName: \${name}-\${version}-setup.\${ext}
  shortcutName: \${productName}
  uninstallDisplayName: \${productName}
  createDesktopShortcut: always
  # Set to true to remove the app's userData folder (settings, caches, logs) on uninstall
  deleteAppDataOnUninstall: true
EOF
if [ "$EB_MAJOR" -ge 27 ]; then
  cat << EOF >> electron-builder.yml
mac:
  sign:
    entitlementsInherit: build/entitlements.mac.plist
EOF
else
  cat << EOF >> electron-builder.yml
mac:
  entitlementsInherit: build/entitlements.mac.plist
EOF
fi
cat << EOF >> electron-builder.yml
  extendInfo:
    - NSCameraUsageDescription: Application uses your camera to take photos and/or videos.
    - NSMicrophoneUsageDescription: Application uses your microphone to record audio.
    - NSDocumentsFolderUsageDescription: Application saves files to your Documents folder.
    - NSDownloadsFolderUsageDescription: Application reads files from your Downloads folder.
dmg:
  artifactName: \${name}-\${version}.\${ext}
linux:
  target:
    - AppImage
    - snap
    - deb
  maintainer: $MAINTAINER
  category: Utility
appImage:
  artifactName: \${name}-\${version}.\${ext}
npmRebuild: false
publish: null
EOF

# Create the python folder
mkdir -p python

# Migrate to python folder bridge.spec and sample-input.json
cp "$TEMPLATE_FILES_DIR/python/bridge.spec" ./python/
cp "$TEMPLATE_FILES_DIR/python/sample-input.json" ./python/

# Migrate main process files
cp "$TEMPLATE_FILES_DIR/$MAIN/index.ts" "./$MAIN/"
cp "$TEMPLATE_FILES_DIR/$MAIN/python.ts" "./$MAIN/"

# Migrate preload process files
cp "$TEMPLATE_FILES_DIR/$PRELOAD/index.ts" "./$PRELOAD/"
cp "$TEMPLATE_FILES_DIR/$PRELOAD/index.d.ts" "./$PRELOAD/"

# Create shared folder
mkdir -p "./$SHARED"

# Migrate custom components
cp "$TEMPLATE_FILES_DIR/$COMPONENTS/EditableTable.tsx" "./$COMPONENTS/"
cp "$TEMPLATE_FILES_DIR/$COMPONENTS/tableTypes.ts" "./$COMPONENTS/"
cp "$TEMPLATE_FILES_DIR/$COMPONENTS/FileDropZone.tsx" "./$COMPONENTS/"
cp "$TEMPLATE_FILES_DIR/$COMPONENTS/IntField.tsx" "./$COMPONENTS/"
cp "$TEMPLATE_FILES_DIR/$COMPONENTS/Step.tsx" "./$COMPONENTS/"

# Migrate renderer process files
cp "$TEMPLATE_FILES_DIR/$RENDERER/App.tsx" "./$RENDERER/"

# Migrate shared files
cp "$TEMPLATE_FILES_DIR/$SHARED/types.ts" "./$SHARED/"
cp "$TEMPLATE_FILES_DIR/$SHARED/validate.ts" "./$SHARED/"

# Migrate python/bridge.py
cp "$TEMPLATE_FILES_DIR/python/bridge.py" ./python/

# Migrate electron-builder.env
cp "$TEMPLATE_FILES_DIR/electron-builder.env" ./

# Download base shadcn/ui components
npx shadcn@latest add \
  card \
  field \
  input \
  button \
  checkbox \
  table \
  alert \
  button-group --overwrite

# Download Roboto font
npm install @fontsource-variable/roboto

# Update main.css
## Teal: lm oklch(0.438 0.074 208) dm oklch(0.738 0.074 208)
## Gold: lm oklch(0.78 0.161 80.5) dm oklch(... 0.161 80.5)
## Red-Orange: lm oklch(0.568 0.163 44.6) dm oklch(... 0.163 44.6)
## Brown: lm oklch(0.496 0.017 74.3) dm oklch(... 0.017 74.3)
## Green: lm oklch(0.568 0.099 125) dm oklch(... 0.099 125)
## Gray: lm oklch(0.866 0.011 76.6) dm oklch(... 0.011 76.6)
## Light Green: lm oklch(0.85 0.051 109) dm oklch(... 0.051 109)
## Light Blue: lm oklch(0.84 0.021 234) dm oklch(... 0.021 234)
## Web Light Blue: lm oklch(0.908 0.01 228.9) dm oklch(0.208 0.01 228.9)
set_fontsource roboto "$ASSETS/main.css"
set_var_css '^@theme' font-sans "'Roboto Variable', sans-serif" "$ASSETS/main.css"
set_var_css '^:root' card 'oklch(0.908 0.01 228.9)' "$ASSETS/main.css"
set_var_css '^:root' primary 'oklch(0.438 0.074 208)' "$ASSETS/main.css"
set_var_css '^\.dark' card 'oklch(0.208 0.01 228.9)' "$ASSETS/main.css"
set_var_css '^\.dark' primary 'oklch(0.738 0.074 208)' "$ASSETS/main.css"

# Final reminders
echo "The workspace is now ready for development."
echo "-------------------------------------------"
echo "Typescript development:"
echo "- src/shared/types.ts (defines custom types and objects for app)"
echo "- src/shared/validate.ts (defines custom validation of inputs from users)"
echo "- src/renderer/src/App.tsx (primary renderer process)"
echo "- src/renderer/src/assets/main.css (custom theming, use ui.shadcn.com/themes to build custom themes)"

echo "Python development:"
echo "- python/{{main_python_script}}.py"
echo "- python/bridge.py (bridge from Typescript to Python)"
echo "- python/sample-input.py (sample input for validation)"
echo "- python3 -m venv python/.venv"
echo "- pip install ..."
echo "- pip install pip-chill && pip-chill > requirements.txt"

echo "Build development:"
echo "- .gitignore (if any stuff has been added that must be excluded from git)"
echo "- electron-builder.env (for signing/notarization credentials)"
