import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface MerkleNode {
  sourcePath: string;
  hash: string;
  children: Record<string, MerkleNode>;
}

export interface MerkleCache {
  version: number;
  tree: MerkleNode;
  timestamp: number;
}

const CACHE_VERSION = 1;

export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

export function computeNodeHash(contentHash: string, childrenHashes: string[]): string {
  const combined = [contentHash, ...childrenHashes.sort()].join('|');
  return computeHash(combined);
}

export function buildMerkleTree(
  nodes: Array<{ sourcePath: string; content: string; isDirectory: boolean }>,
  rootPath: string = ''
): MerkleNode {
  const nodeMap = new Map<string, { content: string; isDirectory: boolean }>();
  for (const node of nodes) {
    nodeMap.set(node.sourcePath, { content: node.content, isDirectory: node.isDirectory });
  }

  const tree: MerkleNode = {
    sourcePath: rootPath,
    hash: '',
    children: {}
  };

  const dirNodes = new Map<string, MerkleNode>();
  dirNodes.set(rootPath, tree);

  const sortedPaths = [...nodeMap.keys()].sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthA - depthB;
  });

  for (const sourcePath of sortedPaths) {
    const info = nodeMap.get(sourcePath)!;
    const parentPath = getParentPath(sourcePath);
    
    let parent = dirNodes.get(parentPath);
    if (!parent) {
      parent = ensureParentPath(dirNodes, tree, parentPath);
    }

    const node: MerkleNode = {
      sourcePath,
      hash: computeHash(info.content),
      children: {}
    };

    if (info.isDirectory) {
      dirNodes.set(sourcePath, node);
    }

    const name = getBaseName(sourcePath);
    parent.children[name] = node;
  }

  computeTreeHashes(tree);

  return tree;
}

function ensureParentPath(dirNodes: Map<string, MerkleNode>, root: MerkleNode, targetPath: string): MerkleNode {
  if (targetPath === '' || dirNodes.has(targetPath)) {
    return dirNodes.get(targetPath) || root;
  }

  const parentPath = getParentPath(targetPath);
  const parent = ensureParentPath(dirNodes, root, parentPath);
  
  const node: MerkleNode = {
    sourcePath: targetPath,
    hash: '',
    children: {}
  };
  
  const name = getBaseName(targetPath);
  parent.children[name] = node;
  dirNodes.set(targetPath, node);
  
  return node;
}

function computeTreeHashes(node: MerkleNode): string {
  const childNames = Object.keys(node.children);
  if (childNames.length === 0) {
    return node.hash;
  }

  const childHashes = childNames.map(name => computeTreeHashes(node.children[name]));
  node.hash = computeNodeHash(node.hash, childHashes);
  return node.hash;
}

function getParentPath(sourcePath: string): string {
  const idx = sourcePath.lastIndexOf('/');
  return idx > 0 ? sourcePath.slice(0, idx) : '';
}

function getBaseName(sourcePath: string): string {
  const idx = sourcePath.lastIndexOf('/');
  return idx >= 0 ? sourcePath.slice(idx + 1) : sourcePath;
}

export interface DiffResult {
  added: string[];
  modified: string[];
  deleted: string[];
}

export function diffMerkleTrees(oldTree: MerkleNode | null, newTree: MerkleNode): DiffResult {
  const result: DiffResult = { added: [], modified: [], deleted: [] };
  
  if (!oldTree) {
    collectAllPaths(newTree, result.added);
    return result;
  }

  diffNodes(oldTree, newTree, result);
  return result;
}

function diffNodes(oldNode: MerkleNode, newNode: MerkleNode, result: DiffResult): void {
  if (oldNode.hash === newNode.hash) {
    return;
  }

  const oldChildren = new Set(Object.keys(oldNode.children));
  const newChildren = new Set(Object.keys(newNode.children));

  for (const name of newChildren) {
    if (!oldChildren.has(name)) {
      collectAllPaths(newNode.children[name], result.added);
    } else {
      const oldChild = oldNode.children[name];
      const newChild = newNode.children[name];
      
      if (oldChild.hash !== newChild.hash) {
        if (Object.keys(newChild.children).length === 0 && Object.keys(oldChild.children).length === 0) {
          result.modified.push(newChild.sourcePath);
        } else {
          if (Object.keys(oldChild.children).length === 0 || Object.keys(newChild.children).length === 0) {
            result.modified.push(newChild.sourcePath);
          }
          diffNodes(oldChild, newChild, result);
        }
      }
    }
  }

  for (const name of oldChildren) {
    if (!newChildren.has(name)) {
      collectAllPaths(oldNode.children[name], result.deleted);
    }
  }
}

function collectAllPaths(node: MerkleNode, paths: string[]): void {
  if (node.sourcePath) {
    paths.push(node.sourcePath);
  }
  for (const name of Object.keys(node.children)) {
    collectAllPaths(node.children[name], paths);
  }
}

export function loadMerkleCache(cachePath: string): MerkleCache | null {
  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    const content = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(content) as MerkleCache;
    if (cache.version !== CACHE_VERSION) {
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

export function saveMerkleCache(cachePath: string, tree: MerkleNode): void {
  const cache: MerkleCache = {
    version: CACHE_VERSION,
    tree,
    timestamp: Date.now()
  };
  
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

export function getCacheFilePath(targetName: string, configDir: string = process.cwd()): string {
  const safeName = targetName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(configDir, '.md-publish-cache', `${safeName}.json`);
}
