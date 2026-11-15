#!/bin/sh
# Fails if any tracked file lives under doc/ or briefs/ (they must never reach GitHub).
bad=$(git ls-files doc briefs)
if [ -n "$bad" ]; then echo "Private paths tracked:"; echo "$bad"; exit 1; fi
echo "private-path check ok"
