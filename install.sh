#!/usr/bin/env sh

set -eu

REPOSITORY="${STOIX_REPOSITORY:-finxray/hermes-ui}"
BRANCH="${STOIX_BRANCH:-master}"
NODE_VERSION="24.15.0"
ARCHIVE_PATH=""
REQUESTED_VERSION="${STOIX_VERSION:-}"
INSTALL_ROOT="${STOIX_INSTALL_ROOT:-}"
BIN_DIR="${STOIX_BIN_DIR:-$HOME/.local/bin}"
CONFIG_ROOT="${STOIX_CONFIG_ROOT:-}"
NO_LAUNCH="${STOIX_NO_LAUNCH:-false}"
NO_INTEGRATE="${STOIX_NO_INTEGRATE:-false}"
SKIP_HERMES="${STOIX_SKIP_HERMES:-false}"
FORCE_SOURCE="${STOIX_FORCE_SOURCE:-false}"
TMP_ROOT=""

info() { printf '%s\n' "[Stoix] $*"; }
warn() { printf '%s\n' "[Stoix] WARNING: $*" >&2; }
fatal() { printf '%s\n' "[Stoix] ERROR: $*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Stoix installer

Usage: sh install.sh [options]

Options:
  --archive PATH     Install a local Stoix package (release smoke/repair).
  --version VERSION  Install a specific published version.
  --install-root DIR Override the per-user installation directory.
  --bin-dir DIR      Override the user command directory.
  --config-root DIR  Override the private configuration directory.
  --skip-hermes      Do not install or configure Hermes Agent.
  --no-launch        Install without starting Stoix.
  --no-integrate     Do not change PATH or create desktop launch entries.
  --source           Build from the public source archive.
  --help             Show this help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --archive) [ "$#" -ge 2 ] || fatal "--archive requires a path."; ARCHIVE_PATH=$2; shift 2 ;;
    --version) [ "$#" -ge 2 ] || fatal "--version requires a value."; REQUESTED_VERSION=$2; shift 2 ;;
    --install-root) [ "$#" -ge 2 ] || fatal "--install-root requires a path."; INSTALL_ROOT=$2; shift 2 ;;
    --bin-dir) [ "$#" -ge 2 ] || fatal "--bin-dir requires a path."; BIN_DIR=$2; shift 2 ;;
    --config-root) [ "$#" -ge 2 ] || fatal "--config-root requires a path."; CONFIG_ROOT=$2; shift 2 ;;
    --skip-hermes) SKIP_HERMES=true; shift ;;
    --no-launch) NO_LAUNCH=true; shift ;;
    --no-integrate) NO_INTEGRATE=true; shift ;;
    --source) FORCE_SOURCE=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fatal "Unknown option: $1" ;;
  esac
done

case "$REQUESTED_VERSION" in
  "") ;;
  v*) REQUESTED_VERSION=${REQUESTED_VERSION#v} ;;
esac
if [ -n "$REQUESTED_VERSION" ] && ! printf '%s' "$REQUESTED_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$'; then
  fatal "Invalid Stoix version: $REQUESTED_VERSION"
fi
printf '%s' "$REPOSITORY" | grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' || fatal "Invalid STOIX_REPOSITORY value."
printf '%s' "$BRANCH" | grep -Eq '^[A-Za-z0-9._/-]+$' || fatal "Invalid STOIX_BRANCH value."

command -v curl >/dev/null 2>&1 || fatal "curl is required. On macOS it is built in; on Debian/Ubuntu run: sudo apt install curl"
command -v tar >/dev/null 2>&1 || fatal "tar is required. Install it with your system package manager, then run this command again."

case "$(uname -s 2>/dev/null || true)" in
  Darwin) PLATFORM=darwin ;;
  Linux) PLATFORM=linux ;;
  *) fatal "This installer supports macOS and Linux. On Windows use install.ps1." ;;
esac

case "$(uname -m 2>/dev/null || true)" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64|amd64) ARCH=x64 ;;
  *) fatal "Unsupported processor architecture: $(uname -m 2>/dev/null || printf unknown)" ;;
esac

if [ -z "$INSTALL_ROOT" ]; then
  if [ "$PLATFORM" = darwin ]; then
    INSTALL_ROOT="$HOME/Applications/Stoix"
  else
    INSTALL_ROOT="$HOME/.local/lib/stoix"
  fi
fi

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/stoix-install.XXXXXX") || fatal "Could not create a temporary installation directory."
cleanup() { [ -n "$TMP_ROOT" ] && rm -rf "$TMP_ROOT"; }
trap cleanup EXIT HUP INT TERM

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 "$1" | awk '{print $NF}'
  else fatal "No SHA-256 tool is available (tried shasum, sha256sum, and openssl)."
  fi
}

verify_checksum() {
  file=$1
  checksum_file=$2
  expected=$(awk 'NF { print $1; exit }' "$checksum_file" | tr 'A-F' 'a-f')
  actual=$(sha256_file "$file" | tr 'A-F' 'a-f')
  printf '%s' "$expected" | grep -Eq '^[0-9a-f]{64}$' || fatal "The downloaded checksum file is invalid."
  [ "$actual" = "$expected" ] || fatal "Checksum verification failed for $(basename "$file"). The file was not installed."
}

latest_release_version() {
  effective=$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/$REPOSITORY/releases/latest" 2>/dev/null || true)
  case "$effective" in
    */releases/tag/v*) printf '%s\n' "${effective##*/v}" ;;
    */releases/tag/*) printf '%s\n' "${effective##*/}" ;;
    *) return 1 ;;
  esac
}

download_release_bundle() {
  version=$REQUESTED_VERSION
  if [ -z "$version" ]; then version=$(latest_release_version) || return 1; fi
  printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$' || return 1
  asset="stoix-$version-$PLATFORM-$ARCH.tar.gz"
  base="https://github.com/$REPOSITORY/releases/download/v$version"
  info "Downloading Stoix $version for $PLATFORM-$ARCH..."
  curl -fL --retry 3 --connect-timeout 15 "$base/$asset" -o "$TMP_ROOT/$asset" || return 1
  curl -fL --retry 3 --connect-timeout 15 "$base/$asset.sha256" -o "$TMP_ROOT/$asset.sha256" || return 1
  verify_checksum "$TMP_ROOT/$asset" "$TMP_ROOT/$asset.sha256"
  mkdir -p "$TMP_ROOT/release"
  tar -xzf "$TMP_ROOT/$asset" -C "$TMP_ROOT/release"
  BUNDLE_ROOT="$TMP_ROOT/release/stoix-$version-$PLATFORM-$ARCH"
  [ -f "$BUNDLE_ROOT/VERSION.json" ] || fatal "The verified Stoix archive does not contain the expected application bundle."
}

download_node_runtime() {
  node_platform=$PLATFORM
  node_asset="node-v$NODE_VERSION-$node_platform-$ARCH.tar.gz"
  node_base="https://nodejs.org/dist/v$NODE_VERSION"
  info "Preparing the temporary Node.js $NODE_VERSION build runtime..."
  curl -fL --retry 3 --connect-timeout 15 "$node_base/$node_asset" -o "$TMP_ROOT/$node_asset" || fatal "Could not download Node.js $NODE_VERSION."
  curl -fL --retry 3 --connect-timeout 15 "$node_base/SHASUMS256.txt" -o "$TMP_ROOT/SHASUMS256.txt" || fatal "Could not download the Node.js checksum list."
  expected=$(awk -v name="$node_asset" '$2 == name { print $1; exit }' "$TMP_ROOT/SHASUMS256.txt")
  [ -n "$expected" ] || fatal "Node.js did not publish a checksum for $node_asset."
  printf '%s  %s\n' "$expected" "$node_asset" > "$TMP_ROOT/node.sha256"
  verify_checksum "$TMP_ROOT/$node_asset" "$TMP_ROOT/node.sha256"
  mkdir -p "$TMP_ROOT/node"
  tar -xzf "$TMP_ROOT/$node_asset" -C "$TMP_ROOT/node"
  NODE_ROOT="$TMP_ROOT/node/node-v$NODE_VERSION-$node_platform-$ARCH"
  [ -x "$NODE_ROOT/bin/node" ] || fatal "The verified Node.js runtime could not be extracted."
}

build_source_bundle() {
  download_node_runtime
  if [ -n "$REQUESTED_VERSION" ]; then
    source_ref="refs/tags/v$REQUESTED_VERSION"
    source_suffix="v$REQUESTED_VERSION"
  else
    source_ref="refs/heads/$BRANCH"
    source_suffix=$BRANCH
  fi
  source_archive="$TMP_ROOT/stoix-source.tar.gz"
  info "Downloading Stoix source ($source_suffix)..."
  curl -fL --retry 3 --connect-timeout 15 "https://github.com/$REPOSITORY/archive/$source_ref.tar.gz" -o "$source_archive" || fatal "Could not download the Stoix source archive."
  mkdir -p "$TMP_ROOT/source"
  tar -xzf "$source_archive" -C "$TMP_ROOT/source"
  SOURCE_ROOT=""
  for candidate in "$TMP_ROOT/source"/*; do
    if [ -d "$candidate" ]; then SOURCE_ROOT=$candidate; break; fi
  done
  [ -f "$SOURCE_ROOT/package-lock.json" ] || fatal "The Stoix source archive is incomplete."
  info "Building the production package. This first install can take several minutes..."
  (
    cd "$SOURCE_ROOT"
    PATH="$NODE_ROOT/bin:$PATH" "$NODE_ROOT/bin/npm" ci --no-audit --no-fund
    PATH="$NODE_ROOT/bin:$PATH" "$NODE_ROOT/bin/npm" run build
    STOIX_RELEASE_PLATFORM="$PLATFORM" STOIX_RELEASE_ARCH="$ARCH" \
      PATH="$NODE_ROOT/bin:$PATH" "$NODE_ROOT/bin/node" scripts/package-release.mjs
  ) || fatal "Stoix could not build. The temporary files were removed; fix the message above and run the installer again."
  BUNDLE_ROOT=""
  for candidate in "$SOURCE_ROOT/artifacts/release"/stoix-*-$PLATFORM-$ARCH; do
    if [ -d "$candidate" ]; then BUNDLE_ROOT=$candidate; break; fi
  done
  [ -n "$BUNDLE_ROOT" ] && [ -f "$BUNDLE_ROOT/VERSION.json" ] || fatal "The Stoix build completed without an installable bundle."
}

if [ -n "$ARCHIVE_PATH" ]; then
  [ -f "$ARCHIVE_PATH" ] || fatal "Local archive not found: $ARCHIVE_PATH"
  mkdir -p "$TMP_ROOT/release"
  tar -xzf "$ARCHIVE_PATH" -C "$TMP_ROOT/release"
  BUNDLE_ROOT=""
  for candidate in "$TMP_ROOT/release"/stoix-*-$PLATFORM-$ARCH; do
    if [ -d "$candidate" ]; then BUNDLE_ROOT=$candidate; break; fi
  done
  [ -n "$BUNDLE_ROOT" ] && [ -f "$BUNDLE_ROOT/VERSION.json" ] || fatal "The local archive is not a Stoix $PLATFORM-$ARCH package."
elif [ "$FORCE_SOURCE" = true ]; then
  build_source_bundle
elif ! download_release_bundle; then
  warn "No compatible published release was found; using the verified-runtime source build path."
  build_source_bundle
fi

VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$BUNDLE_ROOT/VERSION.json" | head -n 1)
printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$' || fatal "The package version metadata is invalid."

VERSIONS_ROOT="$INSTALL_ROOT/versions"
TARGET_ROOT="$VERSIONS_ROOT/$VERSION"
mkdir -p "$VERSIONS_ROOT" "$BIN_DIR"
bundle_is_complete() {
  [ -f "$1/VERSION.json" ] &&
    [ -f "$1/app/apps/web/server.js" ] &&
    [ -f "$1/launcher/stoix-launcher.cjs" ] &&
    [ -x "$1/runtime/node" ] &&
    [ -x "$1/stoix" ]
}
if [ "$FORCE_SOURCE" = true ] && bundle_is_complete "$TARGET_ROOT"; then
  info "Replacing the installed Stoix $VERSION source build..."
  STAGING_ROOT="$VERSIONS_ROOT/.install-$VERSION-$$"
  PREVIOUS_ROOT="$VERSIONS_ROOT/.previous-$VERSION-$$"
  rm -rf "$STAGING_ROOT"
  cp -R "$BUNDLE_ROOT" "$STAGING_ROOT"
  [ -x "$STAGING_ROOT/stoix" ] || chmod 755 "$STAGING_ROOT/stoix" "$STAGING_ROOT/runtime/node"
  bundle_is_complete "$STAGING_ROOT" || fatal "The replacement Stoix bundle is incomplete; the installed version was not changed."
  mv "$TARGET_ROOT" "$PREVIOUS_ROOT"
  if mv "$STAGING_ROOT" "$TARGET_ROOT"; then
    rm -rf "$PREVIOUS_ROOT"
  else
    mv "$PREVIOUS_ROOT" "$TARGET_ROOT" || true
    fatal "Stoix could not replace the installed source build; the previous version was restored."
  fi
elif ! bundle_is_complete "$TARGET_ROOT"; then
  if [ -e "$TARGET_ROOT" ]; then
    INCOMPLETE_ROOT="$VERSIONS_ROOT/.incomplete-$VERSION-$(date +%Y%m%d%H%M%S)-$$"
    warn "The existing Stoix $VERSION installation is incomplete; preserving it at $INCOMPLETE_ROOT and repairing it."
    mv "$TARGET_ROOT" "$INCOMPLETE_ROOT"
  fi
  STAGING_ROOT="$VERSIONS_ROOT/.install-$VERSION-$$"
  rm -rf "$STAGING_ROOT"
  cp -R "$BUNDLE_ROOT" "$STAGING_ROOT"
  [ -x "$STAGING_ROOT/stoix" ] || chmod 755 "$STAGING_ROOT/stoix" "$STAGING_ROOT/runtime/node"
  mv "$STAGING_ROOT" "$TARGET_ROOT"
fi

LINK_TMP="$BIN_DIR/.stoix-link-$$"
ln -s "$TARGET_ROOT/stoix" "$LINK_TMP"
mv -f "$LINK_TMP" "$BIN_DIR/stoix"

add_to_path() {
  command -v stoix >/dev/null 2>&1 && return
  profile="$HOME/.profile"
  [ "${SHELL##*/}" = zsh ] && profile="$HOME/.zprofile"
  line='export PATH="$HOME/.local/bin:$PATH"'
  if [ "$BIN_DIR" = "$HOME/.local/bin" ] && ! grep -F "$line" "$profile" >/dev/null 2>&1; then
    printf '\n# Stoix command\n%s\n' "$line" >> "$profile"
    info "Added ~/.local/bin to your shell PATH for future terminals."
  fi
}
if [ "$NO_INTEGRATE" != true ]; then
  add_to_path
  if [ "$PLATFORM" = darwin ]; then
    APP_BUNDLE="$HOME/Applications/Stoix.app"
    mkdir -p "$APP_BUNDLE/Contents/MacOS"
    ln -sfn "$BIN_DIR/stoix" "$APP_BUNDLE/Contents/MacOS/Stoix"
    cat > "$APP_BUNDLE/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Stoix</string>
  <key>CFBundleExecutable</key><string>Stoix</string>
  <key>CFBundleIdentifier</key><string>com.stoix.local</string>
  <key>CFBundleName</key><string>Stoix</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF
    chmod 755 "$APP_BUNDLE/Contents/MacOS/Stoix"
  else
    APPLICATIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    mkdir -p "$APPLICATIONS_DIR"
    cat > "$APPLICATIONS_DIR/stoix.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Stoix
Comment=Local Web UI for Hermes Agent
Exec="$BIN_DIR/stoix"
Terminal=false
Categories=Development;Utility;
EOF
    chmod 644 "$APPLICATIONS_DIR/stoix.desktop"
  fi
fi

if [ -z "$CONFIG_ROOT" ]; then
  if [ "$PLATFORM" = darwin ]; then
    CONFIG_ROOT="$HOME/Library/Application Support/Stoix"
  else
    CONFIG_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}/stoix"
  fi
fi
CONFIG_PATH="$CONFIG_ROOT/config.env"
mkdir -p "$(dirname "$CONFIG_PATH")"
chmod 700 "$(dirname "$CONFIG_PATH")"
if [ ! -f "$CONFIG_PATH" ]; then
  cat > "$CONFIG_PATH" <<'EOF'
# Stoix local configuration. Keep this file private.
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_UI_ENABLE_REAL_HERMES=true
STOIX_PORT=3210
HERMES_DASHBOARD_BASE_URL=
HERMES_DASHBOARD_SESSION_TOKEN=
EOF
fi
chmod 600 "$CONFIG_PATH"

set_config_value() {
  key=$1
  value=$2
  temp="$CONFIG_PATH.tmp.$$"
  found=false
  : > "$temp"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$key="*) printf '%s=%s\n' "$key" "$value" >> "$temp"; found=true ;;
      *) printf '%s\n' "$line" >> "$temp" ;;
    esac
  done < "$CONFIG_PATH"
  [ "$found" = true ] || printf '%s=%s\n' "$key" "$value" >> "$temp"
  chmod 600 "$temp"
  mv "$temp" "$CONFIG_PATH"
}

find_hermes() {
  if command -v hermes >/dev/null 2>&1; then command -v hermes; return 0; fi
  if [ -x "$HOME/.local/bin/hermes" ]; then printf '%s\n' "$HOME/.local/bin/hermes"; return 0; fi
  return 1
}

hermes_api_ready() {
  curl -fsS --connect-timeout 1 "http://127.0.0.1:8642/health" >/dev/null 2>&1
}

wait_for_hermes_api() {
  attempts=0
  while [ "$attempts" -lt 45 ]; do
    hermes_api_ready && return 0
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

configure_hermes() {
  HERMES_BIN=$(find_hermes) || return 1
  info "Configuring the local Hermes API for Stoix..."
  "$HERMES_BIN" config set API_SERVER_ENABLED true >/dev/null 2>&1 || {
    warn "Hermes is installed, but its API server could not be enabled. Run: hermes config set API_SERVER_ENABLED true"
    return 1
  }
  HERMES_ENV="${HERMES_HOME:-$HOME/.hermes}/.env"
  API_KEY=""
  API_KEY_CHANGED=false
  if [ -f "$HERMES_ENV" ]; then
    API_KEY=$(sed -n 's/^API_SERVER_KEY=//p' "$HERMES_ENV" | tail -n 1 | tr -d '\r')
  fi
  if [ ${#API_KEY} -lt 16 ]; then
    API_KEY=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
    "$HERMES_BIN" config set API_SERVER_KEY "$API_KEY" >/dev/null 2>&1 || {
      warn "Hermes did not accept a local API key. Run: hermes config set API_SERVER_KEY YOUR_PRIVATE_KEY"
      return 1
    }
    API_KEY_CHANGED=true
  fi
  set_config_value HERMES_API_KEY "$API_KEY"
  if [ "$API_KEY_CHANGED" != true ] && hermes_api_ready; then
    info "Hermes gateway is already running."
  else
    # A running gateway does not reload API_SERVER_ENABLED or API_SERVER_KEY.
    # Stop it before installing/starting the service so macOS launchd and Linux
    # systemd both start Hermes with the configuration written above.
    "$HERMES_BIN" gateway stop >/dev/null 2>&1 || true
    if "$HERMES_BIN" gateway install >/dev/null 2>&1 && \
      "$HERMES_BIN" gateway start >/dev/null 2>&1 && \
      wait_for_hermes_api; then
    info "Hermes gateway service is running."
    else
      mkdir -p "${HERMES_HOME:-$HOME/.hermes}/logs"
      nohup "$HERMES_BIN" gateway run --replace --force \
        > "${HERMES_HOME:-$HOME/.hermes}/logs/stoix-gateway.log" 2>&1 &
      if wait_for_hermes_api; then
        info "Hermes gateway is running in the background."
      else
        warn "Hermes was configured but its API did not become ready. Check ${HERMES_HOME:-$HOME/.hermes}/logs/stoix-gateway.log"
      fi
    fi
  fi
  if ! curl -fsS --connect-timeout 1 "http://127.0.0.1:9119/skills" >/dev/null 2>&1; then
    mkdir -p "${HERMES_HOME:-$HOME/.hermes}/logs"
    nohup "$HERMES_BIN" dashboard --host 127.0.0.1 --port 9119 --no-open \
      > "${HERMES_HOME:-$HOME/.hermes}/logs/stoix-dashboard.log" 2>&1 &
    info "Hermes Dashboard is starting in the background. Its first start can take about a minute."
  fi
}

if [ "$SKIP_HERMES" != true ]; then
  if ! find_hermes >/dev/null 2>&1; then
    info "Hermes Agent was not found. Installing it from Nous Research..."
    HERMES_INSTALLER="$TMP_ROOT/hermes-install.sh"
    if curl -fL --retry 3 --connect-timeout 15 "https://hermes-agent.nousresearch.com/install.sh" -o "$HERMES_INSTALLER" && \
      bash "$HERMES_INSTALLER" --skip-setup --non-interactive; then
      info "Hermes Agent installed."
    else
      warn "Stoix is installed, but Hermes installation needs attention."
      warn "Run: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
    fi
  fi
  configure_hermes || warn "Open Stoix and follow the Hermes recovery message, or run: hermes setup"
fi

info "Stoix $VERSION installed successfully."
info "Command: $BIN_DIR/stoix"
info "Configuration: $CONFIG_PATH"
if [ "$NO_LAUNCH" != true ]; then
  mkdir -p "$INSTALL_ROOT/logs"
  info "Starting Stoix; your browser will open when it is ready..."
  nohup "$BIN_DIR/stoix" > "$INSTALL_ROOT/logs/stoix.log" 2>&1 &
else
  info "Launch it later with: $BIN_DIR/stoix"
fi
