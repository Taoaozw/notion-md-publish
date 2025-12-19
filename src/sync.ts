import pLimit from 'p-limit';
import { type Target, resolveTargetSrc } from './config.js';
import { scanSource, buildPageTree, type PageNode } from './scan.js';
import { initClient } from './notion/client.js';
import { fetchManagedPages, buildSourcePathIndex } from './notion/tree.js';
import { createPage, updatePageTitle, updatePageContent } from './notion/pages.js';
import { markdownToBlocks } from './md/toBlocks.js';

const CONCURRENCY_LIMIT = 2;

export interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
}

export interface SyncOptions {
  dryRun: boolean;
}

async function syncNode(
  node: PageNode,
  parentPageId: string,
  sourcePathIndex: Map<string, string>,
  options: SyncOptions,
  result: SyncResult,
  limit: ReturnType<typeof pLimit>
): Promise<string> {
  let pageId = sourcePathIndex.get(node.sourcePath);
  
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
    } else {
      if (options.dryRun) {
        console.log(`[DRY-RUN] 更新页面: ${node.title} (${node.sourcePath || 'root'})`);
      } else {
        console.log(`更新页面: ${node.title} (${node.sourcePath || 'root'})`);
        await limit(() => updatePageTitle(pageId!, node.title));
      }
      result.updated++;
    }
    
    if (node.content && !options.dryRun && pageId) {
      const blocks = markdownToBlocks(node.content);
      await limit(() => updatePageContent(pageId!, blocks));
    }
    
    for (const child of node.children) {
      await syncNode(child, pageId, sourcePathIndex, options, result, limit);
    }
  } catch (error) {
    const errMsg = `处理 ${node.sourcePath || 'root'} 失败: ${error}`;
    console.error(errMsg);
    result.errors.push(errMsg);
  }
  
  return pageId || '';
}

export async function syncTarget(
  target: Target,
  token: string,
  options: SyncOptions
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, errors: [] };
  const limit = pLimit(CONCURRENCY_LIMIT);
  
  console.log(`\n同步目标: ${target.name}`);
  console.log(`源目录: ${target.src}`);
  console.log(`父页面: ${target.parent_page_id}\n`);
  
  initClient(token);
  
  const srcRoot = resolveTargetSrc(target);
  const entries = scanSource(srcRoot);
  const pageTree = buildPageTree(entries, srcRoot);
  
  console.log(`扫描到 ${entries.length} 个文件/目录\n`);
  
  let sourcePathIndex: Map<string, string>;
  
  if (options.dryRun) {
    sourcePathIndex = new Map();
  } else {
    console.log('获取已有的受管页面...');
    const managedPages = await fetchManagedPages(target.parent_page_id);
    sourcePathIndex = buildSourcePathIndex(managedPages);
    console.log(`找到 ${managedPages.length} 个受管页面\n`);
  }
  
  await syncNode(pageTree, target.parent_page_id, sourcePathIndex, options, result, limit);
  
  return result;
}
