#!/usr/bin/env bash
# Builds the production iPhone app and uploads it to App Store Connect, where it appears in TestFlight.
# Usage: bash flutter/tools/testflight.sh
# Needs: Xcode → Settings → Accounts signed in with an Apple ID in the team YU6GT6HQJ8, which lets Xcode
#        make the distribution certificate and profile itself.
# The build number is the time (yyyymmddHHMM), so every upload is higher than the last; the version comes
# from pubspec.yaml.
set -uo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
TEAM=YU6GT6HQJ8
BUILD=$(date +%Y%m%d%H%M)
COMMIT="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain -- .)" ] || COMMIT="$COMMIT-dirty"
OUT=build/testflight
LOG="${TMPDIR:-/tmp}/masterbox-testflight.log"
mkdir -p "$OUT"

# destination upload: the export step sends the app to App Store Connect instead of leaving an .ipa here.
cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key><string>app-store-connect</string>
	<key>destination</key><string>upload</string>
	<key>teamID</key><string>$TEAM</string>
	<key>signingStyle</key><string>automatic</string>
	<key>uploadSymbols</key><true/>
	<key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
EOF

echo "== Building and uploading the production app (build ${BUILD}, commit ${COMMIT})"
if ! flutter build ipa --release --build-number "$BUILD" \
     --dart-define=GRAPHQL_ENDPOINT=https://api.masterbox.masterappinc.com/graphql \
     --dart-define=REALTIME_ENDPOINT=https://api.masterbox.masterappinc.com \
     --dart-define=ADMIN_URL=https://admin.masterbox.masterappinc.com \
     --export-options-plist="$OUT/ExportOptions.plist" > "$LOG" 2>&1; then
  grep -E 'error|Error|ERROR' "$LOG" | grep -v '^\s*$' | tail -8
  echo "❌ Build or upload failed (full log: ${LOG})"; exit 1
fi

# flutter prints "Built IPA" either way, so read Xcode's own distribution log for the upload.
# A warning that WebRTC.framework has no dSYM is expected and does not stop the upload.
DIST_LOG=$(ls -dt "${TMPDIR:-/tmp}"/Runner_*.xcdistributionlogs 2>/dev/null | head -1)
if ! grep -qh 'Upload succeeded' "$DIST_LOG"/*.log 2>/dev/null; then
  echo "❌ Xcode did not report a finished upload (logs: ${LOG}, ${DIST_LOG:-none})"; exit 1
fi
# App Store signing sets aps-environment to production, which the server's APNs key needs; the archive
# itself keeps the development value from Runner.entitlements, so checking it here would say nothing.
echo "✅ Uploaded build ${BUILD} (commit ${COMMIT}). App Store Connect takes about 5–30 minutes before it shows in TestFlight."
