import { mkdirSync, existsSync } from 'fs';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { walkDir } from './walk.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const SOURCE_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.cs', '.cpp', '.c', '.h', '.hpp', '.rb', '.php', '.swift', '.kt', '.scala', '.lua', '.ex', '.exs', '.hs', '.clj', '.ml', '.fs', '.fsx']);

function getDb(projectPath) {
  const dbDir = path.join(projectPath, '.CodersMCP');
  mkdirSync(dbDir, { recursive: true });
  const db = new Database(path.join(dbDir, 'index.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      file TEXT NOT NULL,
      line INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_name ON symbols(name);
    CREATE INDEX IF NOT EXISTS idx_type ON symbols(type);
  `);
  return db;
}

function walkSrc(root, files) {
  walkDir(root, (full, entry) => {
    const ext = path.extname(entry).toLowerCase();
    if (SOURCE_EXTS.has(ext)) files.push(full);
  });
}

const PATTERNS = [
  { regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/m, type: 'function' },
  { regex: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(.*?\)\s*=>)/m, type: 'function' },
  { regex: /^\s*(?:export\s+)?class\s+(\w+)/m, type: 'class' },
  { regex: /^\s*export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/m, type: 'export' },
  { regex: /^\s*module\.exports(?:\.\w+)?\s*=\s*(?:function\s+)?(\w+)/m, type: 'export' },
  { regex: /^\s*def\s+(\w+)\s*\(/m, type: 'function' },
  { regex: /^\s*class\s+(\w+)/m, type: 'class' },
  { regex: /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/m, type: 'function' },
  { regex: /^\s*pub\s+(?:async\s+)?fn\s+(\w+)/m, type: 'function' },
  { regex: /^\s*pub\s+struct\s+(\w+)/m, type: 'class' },
  { regex: /^\s*(?:public|private|protected|internal|static).*?(?:void|int|string|bool|float|double|var|auto|\w+)\s+(\w+)\s*\(/m, type: 'function' },
];

function extractSymbols(filePath) {
  let content;
  try { content = readFileSync(filePath, 'utf8'); } catch (_) { return []; }
  const lines = content.split('\n');
  const found = [];
  const seen = new Set();

  const looksLikeSignatureStart = (l) => {
    const t = l.trim();
    if (!t) return false;
    if (/=>\s*\{?\s*$/.test(t)) return false;
    const opens = (t.match(/\(/g) || []).length;
    const closes = (t.match(/\)/g) || []).length;
    return opens > closes;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const needsJoin = looksLikeSignatureStart(line);
    for (const { regex, type } of PATTERNS) {
      let m = line.match(regex);
      if (!m && needsJoin) {
        const joined = lines.slice(i, i + 8).join(' ');
        m = joined.match(regex);
      }
      if (m && m[1]) {
        const key = `${m[1]}:${i + 1}`;
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ name: m[1], type, file: filePath, line: i + 1 });
        }
      }
    }
  }
  return found;
}

export function graphIndex(args) {
  const { project_path } = args;
  if (!existsSync(project_path)) throw new Error(`graph_index: project_path does not exist: "${project_path}"`);

  const db = getDb(project_path);
  try {
  db.exec('DELETE FROM symbols');

  const files = [];
  walkSrc(project_path, files);

  const insert = db.prepare('INSERT INTO symbols (name, type, file, line) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((syms) => {
    for (const s of syms) insert.run(s.name, s.type, s.file, s.line);
  });

  let totalSymbols = 0;
  for (const f of files) {
    const syms = extractSymbols(f);
    if (syms.length) { insertMany(syms); totalSymbols += syms.length; }
  }
  return { symbols: totalSymbols, files: files.length };
  } finally {
    db.close();
  }
}

export function graphExplore(args) {
  const { project_path, query, type = 'all' } = args;
  const dbPath = path.join(project_path, '.CodersMCP', 'index.db');
  if (!existsSync(dbPath)) throw new Error(`graph_explore: index not found for "${project_path}", run graph_index first`);

  const db = getDb(project_path);
  try {
  const q = `%${query}%`;
  let rows;
  if (type === 'all') {
    rows = db.prepare('SELECT name, type, file, line FROM symbols WHERE name LIKE ? ORDER BY name').all(q);
  } else {
    rows = db.prepare('SELECT name, type, file, line FROM symbols WHERE name LIKE ? AND type = ? ORDER BY name').all(q, type);
  }
  return { results: rows };
  } finally {
    db.close();
  }
}
