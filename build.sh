#!/bin/sh
# Rebuilds index.html from the source parts in src/ (order matters).
cd "$(dirname "$0")/src"
cat head.html island.js helpers.js extras.js animals.js quality.js grade.js main.js > ../index.html
echo "Built index.html"
