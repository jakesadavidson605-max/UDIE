#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${VITE_API_BASE_URL:=}"
export VITE_API_BASE_URL

if [[ ! -d "node_modules/@capacitor/cli" ]]; then
  echo "Capacitor dependencies are missing. Run: pnpm install" >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" && ! -f "android/local.properties" ]]; then
  echo "Android SDK is not configured. Set ANDROID_HOME/ANDROID_SDK_ROOT or create android/local.properties with sdk.dir." >&2
  exit 1
fi

pnpm build:web
pnpm exec cap sync android

cd android
chmod +x ./gradlew
./gradlew assembleDebug
./gradlew assembleRelease
./gradlew bundleRelease

mkdir -p "$ROOT_DIR/artifacts/android"
cp -f app/build/outputs/apk/debug/app-debug.apk "$ROOT_DIR/artifacts/android/udie-debug.apk"
cp -f app/build/outputs/apk/release/app-release-unsigned.apk "$ROOT_DIR/artifacts/android/udie-release-unsigned.apk"
cp -f app/build/outputs/bundle/release/app-release.aab "$ROOT_DIR/artifacts/android/udie-release-unsigned.aab"

echo "Android artifacts written to $ROOT_DIR/artifacts/android"
