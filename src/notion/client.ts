import { Client } from '@notionhq/client';

let notionClient: Client | null = null;

export function initClient(token: string): Client {
  notionClient = new Client({ auth: token });
  return notionClient;
}

export function getClient(): Client {
  if (!notionClient) {
    throw new Error('Notion client 未初始化');
  }
  return notionClient;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;
      
      if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        console.log(`遇到速率限制，等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}
