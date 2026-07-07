#!/bin/sh
cd "$(dirname "$0")"
npx mcp-proxy --port 8090 -- node main.js
