import { spawn } from 'child_process';
import { platform } from 'os';

const IS_WIN = platform() === 'win32';
const MAX_TIMEOUT = 120;

export function run(args) {
  const { command, cwd, timeout = 30 } = args;
  const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT) * 1000;

  return new Promise((resolve) => {
    let shell, shellArgs;
    if (IS_WIN) {
      shell = 'powershell.exe';
      shellArgs = ['-NoProfile', '-NonInteractive', '-Command', command];
    } else {
      shell = '/bin/sh';
      shellArgs = ['-c', command];
    }

    const child = spawn(shell, shellArgs, {
      cwd: cwd || undefined,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
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
