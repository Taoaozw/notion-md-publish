import pLimit from 'p-limit';
import { type Target, resolveTargetSrc } from './config.js';
import { scanSource, buildPageTree, type PageNode, type FileEntry } from './scan.js';
import { initClient } from './notion/client.js';
import { fetchManagedPages, buildSourcePathIndex } from './notion/tree.js';
import { createPage, updatePageTitle, updatePageContent } from './notion/pages.js';
import { markdownToBlocks } from './md/toBlocks.js';
import { buildMerkleTree, diffMerkleTrees, loadMerkleCache, saveMerkleCache, getCacheFilePath, type MerkleNode } from './util/merkle.js';

const CONCURRENCY_LIMIT = 2;

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SyncOptions {
  dryRun: boolean;
  force?: boolean;
}

async function syncNode(
  node: PageNode,
  parentPageId: string,
  sourcePathIndex: Map<string, string>,
  changedPaths: Set<string> | null,
  options: SyncOptions,
  result: SyncResult,
  limit: ReturnType<typeof pLimit>
): Promise<string> {
  let pageId = sourcePathIndex.get(node.sourcePath);
  const needsUpdate = changedPaths === null || changedPaths.has(node.sourcePath);
  
  try {
    if (!pageId) {
      if (options.dryRun) {
        console.log(`[DRY-RUN] 创建页面: ${node.title} (${node.sourcePath || 'root'})`);
        pageId = `dry-run-${node.sourcePath || 'root'}`;
      } else {
        console.log(`创建页面: ${node.title} (${node.sourcePath || 'root'})`);
        pageId = await limit(() => createPage(parentPageId, node.title, node.sourcePath));
        sourcePathIndex.set(node.sourcePath, pageId);
      }
      result.created++;
      
      if (node.content && !options.dryRun && pageId) {
        const blocks = markdownToBlocks(node.content);
        await limit(() => updatePageContent(pageId!, blocks));
      }
    } else if (needsUpdate) {
      if (options.dryRun) {
        console.log(`[DRY-RUN] 更新页面: ${node.title} (${node.sourcePath || 'root'})`);
      } else {
        console.log(`更新页面: ${node.title} (${node.sourcePath || 'root'})`);
        await limit(() => updatePageTitle(pageId!, node.title));
      }
      result.updated++;
      
      if (node.content && !options.dryRun && pageId) {
        const blocks = markdownToBlocks(node.content);
        await limit(() => updatePageContent(pageId!, blocks));
      }
    } else {
      console.log(`跳过未变化: ${node.title} (${node.sourcePath || 'root'})`);
      result.skipped++;
    }
    
    for (const child of node.children) {
      await syncNode(child, pageId, sourcePathIndex, changedPaths, options, result, limit);
    }
  } catch (error) {
    const errMsg = `处理 ${node.sourcePath || 'root'} 失败: ${error}`;
    console.error(errMsg);
    result.errors.push(errMsg);
  }
  
  return pageId || '';
}

function buildMerkleData(entries: FileEntry[]): Array<{ sourcePath: string; content: string; isDirectory: boolean }> {
  const data: Array<{ sourcePath: string; content: string; isDirectory: boolean }> = [];
  
  data.push({ sourcePath: '', content: '', isDirectory: true });
  
  for (const entry of entries) {
    data.push({
      sourcePath: entry.sourcePath,
      content: entry.content || '',
      isDirectory: entry.isDirectory
    });
  }
  
  return data;
}

export async function syncTarget(
  target: Target,
  token: string,
  options: SyncOptions
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const limit = pLimit(CONCURRENCY_LIMIT);
  
  console.log(`\n同步目标: ${target.name}`);
  console.log(`源目录: ${target.src}`);
  console.log(`父页面: ${target.parent_page_id}\n`);
  
  initClient(token);
  
  const srcRoot = resolveTargetSrc(target);
  const entries = scanSource(srcRoot);
  const pageTree = buildPageTree(entries, srcRoot);
  
  console.log(`扫描到 ${entries.length} 个文件/目录\n`);
  
  const merkleData = buildMerkleData(entries);
  const newTree = buildMerkleTree(merkleData);
  
  const cachePath = getCacheFilePath(target.name);
  const oldCache = options.force ? null : loadMerkleCache(cachePath);
  const oldTree: MerkleNode | null = oldCache?.tree ?? null;
  
  let changedPaths: Set<string> | null = null;
  
  if (oldTree && !options.force) {
    const diff = diffMerkleTrees(oldTree, newTree);
    changedPaths = new Set([...diff.added, ...diff.modified]);
    
    if (changedPaths.size === 0) {
      console.log('没有检测到变化，跳过同步\n');
      return result;
    }
    
    console.log(`Merkle Tree 检测到变化:`);
    console.log(`  - 新增: ${diff.added.length}`);
    console.log(`  - 修改: ${diff.modified.length}`);
    console.log(`  - 删除: ${diff.deleted.length}\n`);
  } else {
    console.log('首次同步或强制全量更新\n');
  }
  
  let sourcePathIndex: Map<string, string>;
  
  if (options.dryRun) {
    sourcePathIndex = new Map();
  } else {
    console.log('获取已有的受管页面...');
    const managedPages = await fetchManagedPages(target.parent_page_id);
    sourcePathIndex = buildSourcePathIndex(managedPages);
    console.log(`找到 ${managedPages.length} 个受管页面\n`);
  }
  
  await syncNode(pageTree, target.parent_page_id, sourcePathIndex, changedPaths, options, result, limit);
  
  if (!options.dryRun) {
    saveMerkleCache(cachePath, newTree);
    console.log(`\n缓存已保存到: ${cachePath}`);
  }
  
  return result;
}
