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
  'Read a file as UTF-8 text with optional line range',
  {
    path: z.string().describe('Absolute file path'),
    start_line: z.number().optional().describe('1-indexed start line (inclusive)'),
    end_line: z.number().optional().describe('1-indexed end line (inclusive), -1 = EOF'),
  },
  toolWrap(fsRead)
);

server.tool(
  'fs_write',
  'Write content to a file, normalizing line endings to LF',
  {
    path: z.string().describe('Absolute file path'),
    content: z.string().describe('File content to write'),
  },
  toolWrap(fsWrite)
);

server.tool(
  'fs_replace',
  'Replace first (and only) occurrence of old_str with new_str. Normalizes old_str/new_str line endings to match the file, preserves file line endings on write.',
  {
    path: z.string().describe('Absolute file path'),
    old_str: z.string().describe('Exact string to find (once only)'),
    new_str: z.string().describe('Replacement string'),
  },
  toolWrap(fsReplace)
);

server.tool(
  'fs_search',
  'Recursively search files for a pattern string or regex',
  {
    path: z.string().describe('Root directory to search'),
    pattern: z.string().describe('Search pattern or regex'),
    is_regex: z.boolean().optional().describe('Treat pattern as regex (default false)'),
    file_glob: z.string().optional().describe('Glob filter e.g. "*.js" (default "*")'),
  },
  toolWrap(fsSearch)
);

server.tool(
  'graph_index',
  'Index a project directory for symbol and function lookup',
  {
    project_path: z.string().describe('Absolute path to project root'),
  },
  toolWrap(graphIndex)
);

server.tool(
  'graph_explore',
  'Query the symbol index with fuzzy name search',
  {
    project_path: z.string().describe('Absolute path to project root'),
    query: z.string().describe('Symbol name or partial name'),
    type: z.enum(['function', 'class', 'export', 'all']).optional().describe('Symbol type filter (default "all")'),
  },
  toolWrap(graphExplore)
);

server.tool(
  'run',
  'Execute a shell command with timeout (PowerShell on Windows, /bin/sh elsewhere)',
  {
    command: z.string().describe('Command to execute'),
    cwd: z.string().optional().describe('Working directory'),
    timeout: z.number().optional().describe('Timeout in seconds (default 30, max 120)'),
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
