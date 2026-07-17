import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fsRead, fsWrite, fsReplace, fsSearch } from './src/fs.js';
import { graphIndex, graphExplore } from './src/graph.js';
import { run } from './src/run.js';
import { webFetch } from './src/scrape.js';

const server = new McpServer({ name: 'CodersMCP', version: '1.0.0' });

function toolWrap(fn, asyncFn = false) {
  return async (args) => {
    try {
      const result = asyncFn ? await fn(args) : fn(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: e.message }], isError: true };
    }
  };
}

server.tool(
  'fs_read',
  'Read a file as UTF-8 text with optional line range. Set use_wsl to read a file living inside a WSL distro filesystem',
  {
    path: z.string().describe('Absolute file path (Windows path, or Linux path inside WSL when use_wsl is set)'),
    start_line: z.number().optional().describe('1-indexed start line (inclusive)'),
    end_line: z.number().optional().describe('1-indexed end line (inclusive), -1 = EOF'),
    use_wsl: z.boolean().optional().describe('Treat path as living inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name, required if multiple distros are installed'),
  },
  toolWrap(fsRead)
);

server.tool(
  'fs_write',
  'Write content to a file. Preserves the existing file line endings by default (CRLF/LF), or override via line_endings. Set use_wsl to write a file living inside a WSL distro filesystem',
  {
    path: z.string().describe('Absolute file path (Windows path, or Linux path inside WSL when use_wsl is set)'),
    content: z.string().describe('File content to write'),
    line_endings: z.enum(['preserve', 'lf', 'crlf']).optional().describe('Line ending mode (default "preserve")'),
    use_wsl: z.boolean().optional().describe('Treat path as living inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name, required if multiple distros are installed'),
  },
  toolWrap(fsWrite)
);

server.tool(
  'fs_replace',
  'Replace first (and only) occurrence of old_str with new_str. Normalizes old_str/new_str line endings to match the file, preserves file line endings on write. Set use_wsl to edit a file living inside a WSL distro filesystem',
  {
    path: z.string().describe('Absolute file path (Windows path, or Linux path inside WSL when use_wsl is set)'),
    old_str: z.string().describe('Exact string to find (once only)'),
    new_str: z.string().describe('Replacement string'),
    use_wsl: z.boolean().optional().describe('Treat path as living inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name, required if multiple distros are installed'),
  },
  toolWrap(fsReplace)
);

server.tool(
  'fs_search',
  'Recursively search files for a pattern string or regex. Skips files over 2MB and binary files, caps results at 500 matches (see "truncated" in response). Set use_wsl to search a directory living inside a WSL distro filesystem',
  {
    path: z.string().describe('Root directory to search (Windows path, or Linux path inside WSL when use_wsl is set)'),
    pattern: z.string().describe('Search pattern or regex'),
    is_regex: z.boolean().optional().describe('Treat pattern as regex (default false)'),
    file_glob: z.string().optional().describe('Glob filter e.g. "*.js" (default "*")'),
    use_wsl: z.boolean().optional().describe('Treat path as living inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name, required if multiple distros are installed'),
  },
  toolWrap(fsSearch)
);

server.tool(
  'graph_index',
  'Index a project directory for symbol and function lookup. Set use_wsl to index a project living inside a WSL distro filesystem',
  {
    project_path: z.string().describe('Absolute path to project root (Windows path, or Linux path inside WSL when use_wsl is set)'),
    use_wsl: z.boolean().optional().describe('Treat project_path as living inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name, required if multiple distros are installed'),
  },
  toolWrap(graphIndex)
);

server.tool(
  'graph_explore',
  'Query the symbol index with fuzzy name search. Set use_wsl to query a project indexed from inside a WSL distro filesystem',
  {
    project_path: z.string().describe('Absolute path to project root (Windows path, or Linux path inside WSL when use_wsl is set)'),
    query: z.string().describe('Symbol name or partial name'),
    type: z.enum(['function', 'class', 'export', 'all']).optional().describe('Symbol type filter (default "all")'),
    use_wsl: z.boolean().optional().describe('Treat project_path as living inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name, required if multiple distros are installed'),
  },
  toolWrap(graphExplore)
);

server.tool(
  'run',
  'Execute a shell command with timeout (PowerShell on Windows, /bin/sh elsewhere). Set use_wsl to run inside WSL via wsl.exe bash -lc. If multiple WSL distros exist and distro is not set, returns the list of distros instead of running',
  {
    command: z.string().describe('Command to execute'),
    cwd: z.string().optional().describe('Working directory'),
    timeout: z.number().optional().describe('Timeout in seconds (default 30, max 120)'),
    use_wsl: z.boolean().optional().describe('Run command inside WSL (default false, Windows only)'),
    distro: z.string().optional().describe('WSL distro name to use, required if multiple distros are installed'),
  },
  toolWrap(run, true)
);

server.tool(
  'web_fetch',
  'Fetch a static HTML/documentation page and return its content as Markdown. Does not execute JavaScript (no SPA support).',
  {
    url: z.string().describe('The URL to fetch'),
    timeout_ms: z.number().optional().describe('Request timeout in milliseconds (default 10000)'),
  },
  toolWrap(webFetch, true)
);

const transport = new StdioServerTransport();
await server.connect(transport);
