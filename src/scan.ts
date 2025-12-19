import * as fs from 'fs';
import * as path from 'path';
import { getSourcePath, isReadme, getBaseName, getDirSourcePath, getParentSourcePath } from './util/path.js';
import { getPageTitle, extractH1, sanitizeTitle } from './util/title.js';

export interface FileEntry {
  absolutePath: string;
  sourcePath: string;
  isDirectory: boolean;
  content?: string;
}

export interface PageNode {
  sourcePath: string;
  title: string;
  content: string;
  isDirectory: boolean;
  children: PageNode[];
  readmeSourcePath?: string;
}

function scanDir(dirPath: string, srcRoot: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const sourcePath = getSourcePath(fullPath, srcRoot);
    
    if (item.isDirectory()) {
      entries.push({
        absolutePath: fullPath,
        sourcePath,
        isDirectory: true
      });
      entries.push(...scanDir(fullPath, srcRoot));
    } else if (item.name.toLowerCase().endsWith('.md')) {
      entries.push({
        absolutePath: fullPath,
        sourcePath,
        isDirectory: false,
        content: fs.readFileSync(fullPath, 'utf-8')
      });
    }
  }
  
  return entries;
}

export function scanSource(srcRoot: string): FileEntry[] {
  if (!fs.existsSync(srcRoot)) {
    throw new Error(`源目录不存在: ${srcRoot}`);
  }
  return scanDir(srcRoot, srcRoot);
}

export function buildPageTree(entries: FileEntry[], srcRoot: string): PageNode {
  const rootReadme = entries.find(e => !e.isDirectory && e.sourcePath.toLowerCase() === 'readme.md');
  
  let rootTitle = path.basename(srcRoot);
  let rootContent = '';
  
  if (rootReadme && rootReadme.content) {
    const h1 = extractH1(rootReadme.content);
    if (h1) {
      rootTitle = sanitizeTitle(h1);
    }
    rootContent = rootReadme.content;
  }
  
  const root: PageNode = {
    sourcePath: '',
    title: rootTitle,
    content: rootContent,
    isDirectory: true,
    children: [],
    readmeSourcePath: rootReadme?.sourcePath
  };
  
  const dirMap = new Map<string, PageNode>();
  dirMap.set('', root);
  
  const dirs = entries
    .filter(e => e.isDirectory)
    .sort((a, b) => a.sourcePath.split('/').length - b.sourcePath.split('/').length);
  
  for (const dir of dirs) {
    const dirReadme = entries.find(
      e => !e.isDirectory && 
           getDirSourcePath(e.sourcePath) === dir.sourcePath && 
           isReadme(e.sourcePath)
    );
    
    let title = getBaseName(dir.sourcePath);
    let content = '';
    
    if (dirReadme && dirReadme.content) {
      const h1 = extractH1(dirReadme.content);
      if (h1) {
        title = sanitizeTitle(h1);
      }
      content = dirReadme.content;
    }
    
    const node: PageNode = {
      sourcePath: dir.sourcePath,
      title,
      content,
      isDirectory: true,
      children: [],
      readmeSourcePath: dirReadme?.sourcePath
    };
    
    dirMap.set(dir.sourcePath, node);
    
    const parentPath = getParentSourcePath(dir.sourcePath) ?? '';
    const parent = dirMap.get(parentPath);
    if (parent) {
      parent.children.push(node);
    }
  }
  
  const files = entries.filter(e => !e.isDirectory && !isReadme(e.sourcePath));
  
  for (const file of files) {
    const content = file.content || '';
    const title = getPageTitle(content, getBaseName(file.sourcePath, true));
    
    const node: PageNode = {
      sourcePath: file.sourcePath,
      title,
      content,
      isDirectory: false,
      children: []
    };
    
    const parentPath = getDirSourcePath(file.sourcePath);
    const parent = dirMap.get(parentPath);
    if (parent) {
      parent.children.push(node);
    }
  }
  
  return root;
}
