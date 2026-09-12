# UDIE Android build with Capacitor

UDIE is packaged as a native Android shell around the existing Vite production web build. Capacitor uses `dist/public` as its web asset directory, with application ID `com.udie.app` and app name `UDIE`.

## GitHub Codespaces setup

Use the included `.devcontainer/devcontainer.json` when creating or rebuilding a Codespace. It provisions Node 22, Java 21, Android API 36, and build tools 36.0.0. The repository includes the Gradle wrapper; Android Studio is not required for command-line builds.

```bash
corepack enable
pnpm install

# Point the bundled app at the deployed UDIE backend.
export VITE_API_BASE_URL="https://your-udie-production-domain.example"

# Build web assets, sync Capacitor, and create APK/AAB outputs.
pnpm android:build
```

Artifacts are written to `artifacts/android/`:

| Artifact | Purpose |
|---|---|
| `udie-debug.apk` | Installable development APK; suitable for emulator/device smoke tests. |
| `udie-release-unsigned.apk` | Release-mode APK before signing. |
| `udie-release-unsigned.aab` | Release-mode App Bundle before signing. |

To install the debug APK on a connected device or emulator:

```bash
adb install -r artifacts/android/udie-debug.apk
```

The equivalent lower-level commands are:

```bash
pnpm build:web
pnpm exec cap sync android
cd android
./gradlew assembleDebug
./gradlew assembleRelease
./gradlew bundleRelease
```

## GitHub Actions

`.github/workflows/android.yml` builds the web assets, runs `cap sync`, compiles the debug APK, and produces release-mode APK/AAB artifacts. Set the repository variable `VITE_API_BASE_URL` to the deployed backend URL before running the workflow. The workflow uploads the three Android artifacts for download from the Actions run.

## Play Store release signing

The generated release APK/AAB are intentionally unsigned. For Play Store distribution, create an upload keystore outside the repository and add signing configuration through GitHub Actions secrets or a local Gradle `release` signing block. Never commit keystores, passwords, or `google-services.json` containing secrets.

A typical Codespaces signing flow is:

```bash
keytool -genkeypair -v -keystore udie-upload.jks \
  -alias udie-upload -keyalg RSA -keysize 2048 -validity 10000
export UDIE_KEYSTORE_PATH="$PWD/udie-upload.jks"
export UDIE_KEY_ALIAS="udie-upload"
export UDIE_KEYSTORE_PASSWORD="..."
export UDIE_KEY_PASSWORD="..."
```

The current repository deliberately does not hard-code signing secrets. Add the signing block to `android/app/build.gradle` through your private deployment configuration, then run `./gradlew bundleRelease`.

## Network and authentication

`client/src/main.tsx` uses `VITE_API_BASE_URL` for native API calls and keeps browser builds relative to `/api/trpc` when the variable is empty. The backend allows `capacitor://localhost` and localhost development origins for native tRPC requests. The production server must be reachable over HTTPS.

The Android manifest grants Internet and network-state access, plus legacy external-storage compatibility permissions capped to older Android versions. Modern Android app-private storage does not require broad storage permission. OAuth login still uses the existing Manus web flow; production native login should be validated against the deployed OAuth redirect configuration because the bundled Capacitor origin is `capacitor://localhost` rather than the browser preview origin.

## Capacitor commands

```bash
pnpm exec cap sync android
pnpm exec cap open android
pnpm exec cap doctor
```
