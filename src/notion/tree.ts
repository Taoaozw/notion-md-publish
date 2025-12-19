import { getClient, withRetry } from './client.js';
import type { PageObjectResponse, BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';

export interface ManagedPage {
  pageId: string;
  sourcePath: string;
  title: string;
}

const MANAGED_BY_KEY = 'md-publish';
const MARKER_PREFIX = '<!--md-publish:';
const MARKER_SUFFIX = '-->';

function parseMarker(text: string): string | null {
  if (text.startsWith(MARKER_PREFIX) && text.endsWith(MARKER_SUFFIX)) {
    return text.slice(MARKER_PREFIX.length, -MARKER_SUFFIX.length);
  }
  return null;
}

export function createMarker(sourcePath: string): string {
  return `${MARKER_PREFIX}${sourcePath}${MARKER_SUFFIX}`;
}

async function getPageFirstBlock(pageId: string): Promise<BlockObjectResponse | null> {
  const client = getClient();
  const response = await withRetry(() =>
    client.blocks.children.list({
      block_id: pageId,
      page_size: 1
    })
  );
  
  if (response.results.length > 0) {
    return response.results[0] as BlockObjectResponse;
  }
  return null;
}

async function extractSourcePathFromPage(pageId: string): Promise<string | null> {
  const firstBlock = await getPageFirstBlock(pageId);
  if (!firstBlock) return null;
  
  if (firstBlock.type === 'paragraph') {
    const paragraph = firstBlock as BlockObjectResponse & { paragraph: { rich_text: Array<{ plain_text: string }> } };
    const text = paragraph.paragraph?.rich_text?.[0]?.plain_text || '';
    return parseMarker(text);
  }
  
  return null;
}

export async function fetchManagedPages(parentPageId: string): Promise<ManagedPage[]> {
  const client = getClient();
  const managedPages: ManagedPage[] = [];
  
  let cursor: string | undefined = undefined;
  
  do {
    const response = await withRetry(() =>
      client.blocks.children.list({
        block_id: parentPageId,
        start_cursor: cursor,
        page_size: 100
      })
    );
    
    for (const block of response.results) {
      if ('type' in block && block.type === 'child_page') {
        const pageId = block.id;
        const title = (block as { child_page: { title: string } }).child_page.title;
        
        const sourcePath = await extractSourcePathFromPage(pageId);
        if (sourcePath !== null) {
          managedPages.push({ pageId, sourcePath, title });
          
          const childPages = await fetchManagedPages(pageId);
          managedPages.push(...childPages);
        }
      }
    }
    
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  
  return managedPages;
}

export function buildSourcePathIndex(pages: ManagedPage[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const page of pages) {
    index.set(page.sourcePath, page.pageId);
  }
  return index;
}
