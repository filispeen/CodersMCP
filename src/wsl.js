import { execSync } from 'child_process';
import { platform } from 'os';

const IS_WIN = platform() === 'win32';

export function listWslDistros() {
  if (!IS_WIN) return [];
  try {
    const raw = execSync('wsl.exe -l -q', { encoding: 'utf16le' });
    return raw
      .split(/\r?\n/)
      .map((s) => s.replace(/\u0000/g, '').trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function requireSingleDistro(distro) {
  if (distro) return { ok: true, distro };
  const distros = listWslDistros();
  if (distros.length === 0) {
    return { ok: false, error: 'wsl: no WSL distros found' };
  }
  if (distros.length > 1) {
    return { ok: false, error: `wsl: multiple WSL distros found, specify distro param: ${distros.join(', ')}` };
  }
  return { ok: true, distro: distros[0] };
}

export function toWslPath(winPath, distro) {
  try {
    const distroArgs = distro ? ['-d', distro] : [];
    const out = execSync(
      `wsl.exe ${distroArgs.join(' ')} wslpath -a "${winPath.replace(/\\/g, '\\\\')}"`,
      { encoding: 'utf8' }
    ).trim();
    return out || null;
  } catch (_) {
    return null;
  }
}

function isAlreadyUncOrWindows(p) {
  return /^[a-zA-Z]:\\/.test(p) || p.startsWith('\\\\');
}

export function resolveWslFsPath(inputPath, distro) {
  if (!IS_WIN) return inputPath;
  if (isAlreadyUncOrWindows(inputPath)) return inputPath;
  const cleanDistro = distro.replace(/\\/g, '');
  const linuxPath = inputPath.startsWith('/') ? inputPath : `/${inputPath}`;
  const winStyle = linuxPath.replace(/\//g, '\\');
  return `\\\\wsl.localhost\\${cleanDistro}${winStyle}`;
}
