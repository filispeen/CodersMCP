import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createRequire } from 'module';
import ig from 'ignore';
import { minimatch } from 'minimatch';
import { readdirSync, statSync, existsSync } from 'fs';

const SKIP_DIRS = new Set(['node_modules', '__pycache__', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.venv', 'venv', 'target', 'out', '.CodersMCP']);

function detectLineEnding(buf) {
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) return 'crlf';
  }
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) return 'lf';
  }
  return 'lf';
}

function applyLineEnding(str, ending) {
  const lf = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (ending === 'crlf') return lf.replace(/\n/g, '\r\n');
  return lf;
}

export function fsRead(args) {
  const { path, start_line, end_line } = args;
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(`fs_read: cannot read file "${path}": ${e.message}`);
  }
  const lines = raw.split('\n');
  const total_lines = lines.length;
  const s = start_line != null ? start_line - 1 : 0;
  const e2 = end_line == null ? lines.length : end_line === -1 ? lines.length : end_line;
  const slice = lines.slice(s, e2);
  return { content: slice.join('\n'), total_lines };
}

export function fsWrite(args) {
  const { path, content, line_endings = 'preserve' } = args;
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch (_) {}

  let ending;
  if (line_endings === 'preserve') {
    try {
      const existing = readFileSync(path);
      ending = detectLineEnding(existing);
    } catch (_) {
      ending = 'lf';
    }
  } else {
    ending = line_endings;
  }

  const normalized = applyLineEnding(content, ending);
  const buf = Buffer.from(normalized, 'utf8');
  try {
    writeFileSync(path, buf);
  } catch (e) {
    throw new Error(`fs_write: cannot write file "${path}": ${e.message}`);
  }
  return { written_bytes: buf.length, line_endings: ending };
}

export function fsReplace(args) {
  const { path, old_str, new_str } = args;
  let buf;
  try {
    buf = readFileSync(path);
  } catch (e) {
    throw new Error(`fs_replace: cannot read file "${path}": ${e.message}`);
  }

  const fileEnding = detectLineEnding(buf);

  const oldNormalized = applyLineEnding(old_str, fileEnding);
  const newNormalized = applyLineEnding(new_str, fileEnding);

  const oldBuf = Buffer.from(oldNormalized, 'utf8');
  const newBuf = Buffer.from(newNormalized, 'utf8');

  let firstIdx = -1;
  let count = 0;
  for (let i = 0; i <= buf.length - oldBuf.length; i++) {
    let match = true;
    for (let j = 0; j < oldBuf.length; j++) {
      if (buf[i + j] !== oldBuf[j]) { match = false; break; }
    }
    if (match) { count++; if (firstIdx === -1) firstIdx = i; }
  }

  if (count === 0) throw new Error(`fs_replace: old_str not found in file "${path}"`);
  if (count > 1) throw new Error(`fs_replace: old_str matches ${count} times in file "${path}", must be unique`);

  const result = Buffer.concat([buf.slice(0, firstIdx), newBuf, buf.slice(firstIdx + oldBuf.length)]);
  try {
    writeFileSync(path, result);
  } catch (e) {
    throw new Error(`fs_replace: cannot write file "${path}": ${e.message}`);
  }
  return { replaced: true, byte_offset: firstIdx, line_endings: fileEnding };
}

function loadGitignore(root) {
  const ig2 = ig();
  const giPath = root + '/.gitignore';
  if (existsSync(giPath)) {
    try {
      ig2.add(readFileSync(giPath, 'utf8'));
    } catch (_) {}
  }
  return ig2;
}

function walkFiles(root, fileGlob, ignorer, results) {
  let entries;
  try { entries = readdirSync(root); } catch (_) { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = root + '/' + entry;
    let stat;
    try { stat = statSync(full); } catch (_) { continue; }
    const rel = full.replace(/\\/g, '/');
    if (stat.isDirectory()) {
      walkFiles(full, fileGlob, ignorer, results);
    } else if (stat.isFile()) {
      if (fileGlob && fileGlob !== '*' && !minimatch(entry, fileGlob)) continue;
      results.push(full);
    }
  }
}

export function fsSearch(args) {
  const { path, pattern, is_regex = false, file_glob = '*' } = args;
  const ignorer = loadGitignore(path);
  const files = [];
  walkFiles(path.replace(/\\/g, '/'), file_glob, ignorer, files);

  let regex;
  if (is_regex) {
    try { regex = new RegExp(pattern); } catch (e) {
      throw new Error(`fs_search: invalid regex "${pattern}": ${e.message}`);
    }
  }

  const matches = [];
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch (_) { continue; }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hit = is_regex ? regex.test(line) : line.includes(pattern);
      if (hit) matches.push({ file, line: i + 1, text: line });
    }
  }
  return { matches };
}
