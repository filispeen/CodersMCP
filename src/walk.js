import { readdirSync, statSync } from 'fs';
import path from 'path';

export const SKIP_DIRS = new Set(['node_modules', '__pycache__', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.venv', 'venv', 'target', 'out', '.CodersMCP']);

export function walkDir(root, onFile) {
  let entries;
  try { entries = readdirSync(root); } catch (_) { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(root, entry);
    let stat;
    try { stat = statSync(full); } catch (_) { continue; }
    if (stat.isDirectory()) {
      walkDir(full, onFile);
    } else if (stat.isFile()) {
      onFile(full, entry, stat);
    }
  }
}
