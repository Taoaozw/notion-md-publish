import { getClient, withRetry } from './client.js';
import { createMarker } from './tree.js';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints.js';

export async function createPage(
  parentPageId: string,
  title: string,
  sourcePath: string
): Promise<string> {
  const client = getClient();
  
  const response = await withRetry(() =>
    client.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: {
          type: 'title',
          title: [{ type: 'text', text: { content: title } }]
        }
      }
    })
  );
  
  const marker = createMarker(sourcePath);
  await withRetry(() =>
    client.blocks.children.append({
      block_id: response.id,
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: marker } }]
        }
      }]
    })
  );
  
  return response.id;
}

export async function updatePageTitle(pageId: string, title: string): Promise<void> {
  const client = getClient();
  
  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties: {
        title: {
          type: 'title',
          title: [{ type: 'text', text: { content: title } }]
        }
      }
    })
  );
}

export async function clearPageContent(pageId: string): Promise<void> {
  const client = getClient();
  
  let cursor: string | undefined = undefined;
  const blockIds: string[] = [];
  
  do {
    const response = await withRetry(() =>
      client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100
      })
    );
    
    let isFirst = true;
    for (const block of response.results) {
      if (isFirst) {
        isFirst = false;
        continue;
      }
      blockIds.push(block.id);
    }
    
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  
  for (const blockId of blockIds) {
    await withRetry(() =>
      client.blocks.delete({ block_id: blockId })
    );
  }
}

export async function appendBlocks(pageId: string, blocks: BlockObjectRequest[]): Promise<void> {
  const client = getClient();
  
  const BATCH_SIZE = 100;
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    await withRetry(() =>
      client.blocks.children.append({
        block_id: pageId,
        children: batch
      })
    );
  }
}

export async function updatePageContent(
  pageId: string,
  blocks: BlockObjectRequest[]
): Promise<void> {
  await clearPageContent(pageId);
  await appendBlocks(pageId, blocks);
}
