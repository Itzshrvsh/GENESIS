#!/usr/bin/env bash
set -e

# Resolve project root (assumes this script is in ./scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Paths
SPEC_FILE="$PROJECT_ROOT/backend/openapi.yaml"
OUTPUT_FILE="$PROJECT_ROOT/frontend/src/api/client.ts"

# Verify spec exists
if [[ ! -f "$SPEC_FILE" ]]; then
  echo "Error: OpenAPI spec not found at $SPEC_FILE"
  exit 1
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Generate TypeScript client using openapi-typescript
npx openapi-typescript "$SPEC_FILE" --output "$OUTPUT_FILE"

echo "Generated TypeScript client at $OUTPUT_FILE"