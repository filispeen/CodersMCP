# CodersMCP

MCP server for Claude Desktop. Built to fix real problems hit when using WindowsMCP + Codegraph on Windows projects: CRLF/LF line ending mismatches and Cyrillic content encoding issues, on top of saving tool-call budget for common edit workflows.

Runs alongside a `codegraph` MCP server, both registered in `claude_desktop_config.json`.

## Tools

- `fs_read` - read a file as UTF-8 text, optional line range
- `fs_write` - write content to a file. `line_endings` param: `lf`, `crlf`, or `preserve` (default `preserve`, detects and respects the file's existing line ending)
- `fs_replace` - replace the first (and only) occurrence of `old_str` with `new_str`, CRLF-safe
- `fs_search` - recursive pattern/regex search, respects `.gitignore`
- `graph_index` - index a project directory for symbol and function lookup, stored in `.CodersMCP/index.db`
- `graph_explore` - fuzzy symbol name search across the index
- `run` - execute a shell command with timeout (PowerShell on Windows, `/bin/sh` elsewhere)

## Installation

Add to `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json` or `%appdata%\..\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "CodersMCP": {
      "type": "stdio",
      "command": "node",
      "args": ["F:/Code/nodejs/CodersMCP/main.js"]
    }
  }
}
```

Use forward slashes in `args`, even on Windows.

## Setup

```bash
npm install
node test.js
```

## Why CRLF/LF handling matters

JSON-transported strings (as used by MCP over stdio) always arrive as LF (`\n`), regardless of the source file's actual encoding. A naive string search/replace on a Windows file that uses CRLF (`\r\n`) will silently fail to match, because the bytes differ at every line break.

`fs_replace` detects the file's actual line ending via `detectLineEnding` and normalizes both `old_str` and `new_str` to match it via `applyLineEnding` before doing the search/replace. This avoids silent no-op failures on CRLF files.

`fs_write` defaults to `preserve`: it detects the existing file's line ending and keeps it, rather than unconditionally forcing LF (which used to break CRLF-based Windows projects). Pass `line_endings: "lf"` or `"crlf"` to force a specific ending, e.g. for new files.

This same byte-level care matters for Cyrillic and other multi-byte UTF-8 content, where operations that assume ASCII byte boundaries can corrupt text.

## Known workarounds / gotchas

- If `fs_replace` itself is broken, `Windows-MCP:PowerShell` with `[System.IO.File]::ReadAllText` / `WriteAllText` and explicit `` `r`n `` strings is a reliable fallback for patching CRLF files.
- PowerShell heredoc syntax (`<< 'EOF'`) is not supported. Write multi-line scripts to a `.js` file first, then run with `node filename.js`.
- For MCP stdio startup verification, prefer `node -e "import('./main.js')..."` over piping JSON through PowerShell byte arrays, which is unreliable.
- Never use PowerShell `ConvertTo-Json` to merge into existing JSON config files (e.g. `claude_desktop_config.json`) - it can corrupt the existing structure. Construct the JSON string manually and write it directly.

## Tool call budget comparison

| Task: edit one function in a file | WindowsMCP + Codegraph | CodersMCP |
|---|---|---|
| Find symbol location | codegraph_explore (1) | graph_explore (1) |
| Read file or range | FileSystem:read (1) | fs_read (1) |
| Write change | FileSystem:write (1-2) | fs_replace (1) |
| Verify | FileSystem:read (1) | fs_read (1) |
| **Total** | **4-5** | **4** |

`fs_replace` avoids re-reading the whole file, editing in memory, and writing it all back. You specify only the changed block. On large or Cyrillic-heavy files, this removes an entire error-prone round-trip.

## Stack

ESM Node.js project using `@modelcontextprotocol/sdk`, `better-sqlite3` (loaded via `createRequire` for ESM compatibility), `ignore`, `minimatch`.

## License

ISC
