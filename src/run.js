import { spawn, execSync } from 'child_process';
import { platform } from 'os';

const IS_WIN = platform() === 'win32';
const MAX_TIMEOUT = 120;

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL';

function freshWindowsPath() {
  try {
    const machine = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "[Environment]::GetEnvironmentVariable(\'Path\',\'Machine\')"',
      { encoding: 'utf8' }
    ).trim();
    const user = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "[Environment]::GetEnvironmentVariable(\'Path\',\'User\')"',
      { encoding: 'utf8' }
    ).trim();
    return [machine, user].filter(Boolean).join(';');
  } catch (_) {
    return process.env.PATH;
  }
}

function freshWindowsPathExt() {
  try {
    const machine = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "[Environment]::GetEnvironmentVariable(\'PATHEXT\',\'Machine\')"',
      { encoding: 'utf8' }
    ).trim();
    if (machine) return machine;
  } catch (_) {}
  return DEFAULT_PATHEXT;
}

export function run(args) {
  const { command, cwd, timeout = 30 } = args;
  const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT) * 1000;

  return new Promise((resolve) => {
    let shell, shellArgs;
    const env = { ...process.env };
    if (IS_WIN) {
      shell = 'powershell.exe';
      env.PATH = freshWindowsPath();
      env.PATHEXT = freshWindowsPathExt();
      const wrapped = `$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8; & { ${command} } 2>&1 | Out-String -Width 512`;
      shellArgs = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', wrapped];
    } else {
      shell = '/bin/sh';
      shellArgs = ['-c', command];
    }

    const child = spawn(shell, shellArgs, {
      cwd: cwd || undefined,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (_) {}
    }, effectiveTimeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exit_code: timedOut ? -1 : (code ?? -1),
        stdout,
        stderr: timedOut ? `run: command timed out after ${timeout}s\n` + stderr : stderr,
      });
    });

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ exit_code: -1, stdout: '', stderr: `run: spawn error: ${e.message}` });
    });
  });
}
