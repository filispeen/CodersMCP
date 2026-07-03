import { fsRead, fsWrite, fsReplace, fsSearch } from './src/fs.js';
import { graphIndex, graphExplore } from './src/graph.js';
import { run } from './src/run.js';

const TEST = 'F:/Code/nodejs/CodersMCP/test_tmp.txt';
let ok = true;

function check(label, cond) {
  if (!cond) { console.error('FAIL:', label); ok = false; }
  else console.log('PASS:', label);
}

const w = fsWrite({ path: TEST, content: "line1\r\nline2\r\nfunction hello() {}\r\n" });
check('write returns bytes', w.written_bytes > 0);

const r = fsRead({ path: TEST });
check('read no CRLF', !r.content.includes('\r'));
check('read total_lines', r.total_lines === 4);

const rng = fsRead({ path: TEST, start_line: 2, end_line: 3 });
check('read range line2', rng.content.includes('line2'));

const rep = fsReplace({ path: TEST, old_str: 'hello', new_str: 'world' });
check('replace offset', rep.byte_offset >= 0);
const after = fsRead({ path: TEST });
check('replace content', after.content.includes('world') && !after.content.includes('hello'));

try {
  fsReplace({ path: TEST, old_str: 'NOTEXIST', new_str: 'x' });
  check('replace missing throws', false);
} catch (e) {
  check('replace missing throws', e.message.includes('not found'));
}

const srch = fsSearch({ path: 'F:/Code/nodejs/CodersMCP/src', pattern: 'fsWrite' });
check('search finds fsWrite', srch.matches.length > 0);

const idx = graphIndex({ project_path: 'F:/Code/nodejs/CodersMCP' });
check('index symbols > 0', idx.symbols > 0);
check('index files > 0', idx.files > 0);

const exp = graphExplore({ project_path: 'F:/Code/nodejs/CodersMCP', query: 'fsRead' });
check('explore finds fsRead', exp.results.length > 0);

const runR = await run({ command: 'echo hello_world', timeout: 5 });
check('run exit_code 0', runR.exit_code === 0);
check('run stdout', runR.stdout.trim().includes('hello_world'));

const runT = await run({ command: 'Start-Sleep 10', timeout: 2 });
check('run timeout exit_code -1', runT.exit_code === -1);
check('run timeout stderr', runT.stderr.includes('timed out'));

import { unlinkSync } from 'fs';
try { unlinkSync(TEST.replace(/\//g, '\\')); } catch (_) {}

if (!ok) process.exit(1);
console.log('ALL PASS');
