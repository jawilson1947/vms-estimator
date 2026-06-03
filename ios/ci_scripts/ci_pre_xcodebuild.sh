#!/bin/sh
# Inject secrets into xcconfig before Xcode Cloud builds

# Print environment for debugging
echo "CI_WORKSPACE: $CI_WORKSPACE"
echo "CI_PRIMARY_REPOSITORY_PATH: $CI_PRIMARY_REPOSITORY_PATH"

# Determine repo root — CI_PRIMARY_REPOSITORY_PATH is more reliable than CI_WORKSPACE
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$CI_WORKSPACE}"

RELEASE_XCCONFIG="$REPO_ROOT/ios/Release.xcconfig"
DEBUG_XCCONFIG="$REPO_ROOT/ios/Debug.xcconfig"

echo "Looking for xcconfig at: $RELEASE_XCCONFIG"

if [ ! -f "$RELEASE_XCCONFIG" ]; then
    echo "ERROR: Release.xcconfig not found at $RELEASE_XCCONFIG"
    exit 1
fi

if [ -n "$CLAUDE_API_KEY" ]; then
    echo "CLAUDE_API_KEY = $CLAUDE_API_KEY" >> "$RELEASE_XCCONFIG"
    echo "CLAUDE_API_KEY = $CLAUDE_API_KEY" >> "$DEBUG_XCCONFIG"
    echo "CLAUDE_API_KEY injected successfully."
else
    echo "WARNING: CLAUDE_API_KEY environment variable is not set — check Xcode Cloud secrets."
fi
