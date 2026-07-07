@echo off
cd /d "%~dp0"
npx mcp-proxy --port 8090 -- node main.js
