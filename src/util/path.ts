import * as path from 'path';

export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

export function getSourcePath(filePath: string, srcRoot: string): string {
  const relativePath = path.relative(srcRoot, filePath);
  return toPosixPath(relativePath);
}

export function isValidSourcePath(sourcePath: string): boolean {
  if (sourcePath.startsWith('/')) return false;
  if (sourcePath.includes('..')) return false;
  if (sourcePath.startsWith('.')) return false;
  return true;
}

export function getParentSourcePath(sourcePath: string): string | null {
  const parts = sourcePath.split('/');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('/');
}

export function getBaseName(sourcePath: string, removeExt: boolean = false): string {
  const name = sourcePath.split('/').pop() || '';
  if (removeExt) {
    return name.replace(/\.md$/i, '');
  }
  return name;
}

export function isReadme(sourcePath: string): boolean {
  const baseName = getBaseName(sourcePath).toLowerCase();
  return baseName === 'readme.md';
}

export function getDirSourcePath(sourcePath: string): string {
  const parts = sourcePath.split('/');
  if (sourcePath.toLowerCase().endsWith('.md')) {
    parts.pop();
  }
  return parts.join('/');
}
