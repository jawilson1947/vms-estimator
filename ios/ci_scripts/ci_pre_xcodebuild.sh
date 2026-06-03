#!/bin/sh
# Inject secrets into xcconfig before Xcode Cloud builds
set -e

if [ -n "$CLAUDE_API_KEY" ]; then
    echo "CLAUDE_API_KEY = $CLAUDE_API_KEY" >> "$CI_WORKSPACE/ios/Release.xcconfig"
    echo "CLAUDE_API_KEY = $CLAUDE_API_KEY" >> "$CI_WORKSPACE/ios/Debug.xcconfig"
    echo "ci_pre_xcodebuild: CLAUDE_API_KEY injected."
else
    echo "ci_pre_xcodebuild: WARNING - CLAUDE_API_KEY not set."
fi
