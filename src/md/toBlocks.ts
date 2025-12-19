import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints.js';
import { parseMarkdown, type ParsedToken } from './parse.js';

type RichTextItemRequest = {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

function createRichText(text: string): RichTextItemRequest[] {
  if (!text) return [];
  const chunks: RichTextItemRequest[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, 2000);
    remaining = remaining.slice(2000);
    chunks.push({
      type: 'text',
      text: { content: chunk }
    });
  }
  
  return chunks;
}

function parseInlineText(text: string): RichTextItemRequest[] {
  const result: RichTextItemRequest[] = [];
  let remaining = text;
  
  const patterns = [
    { regex: /\*\*(.+?)\*\*/s, annotation: { bold: true } },
    { regex: /\*(.+?)\*/s, annotation: { italic: true } },
    { regex: /`(.+?)`/s, annotation: { code: true } },
    { regex: /~~(.+?)~~/s, annotation: { strikethrough: true } },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/s, isLink: true },
  ];
  
  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: string; annotation?: object; url?: string } | null = null;
    
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          if (pattern.isLink) {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              content: match[1],
              url: match[2]
            };
          } else {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              content: match[1],
              annotation: pattern.annotation
            };
          }
        }
      }
    }
    
    if (earliestMatch) {
      if (earliestMatch.index > 0) {
        result.push(...createRichText(remaining.slice(0, earliestMatch.index)));
      }
      
      const item: RichTextItemRequest = {
        type: 'text',
        text: { 
          content: earliestMatch.content.slice(0, 2000),
          link: earliestMatch.url ? { url: earliestMatch.url } : null
        }
      };
      
      if (earliestMatch.annotation) {
        item.annotations = earliestMatch.annotation as RichTextItemRequest['annotations'];
      }
      
      result.push(item);
      remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
    } else {
      result.push(...createRichText(remaining));
      break;
    }
  }
  
  return result;
}

function tokenToBlocks(token: ParsedToken): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];
  
  switch (token.type) {
    case 'heading': {
      const depth = token.depth || 1;
      const text = token.text || '';
      const richText = parseInlineText(text);
      
      if (depth === 1) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: richText }
        } as BlockObjectRequest);
      } else if (depth === 2) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: richText }
        } as BlockObjectRequest);
      } else {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: richText }
        } as BlockObjectRequest);
      }
      break;
    }
    
    case 'paragraph': {
      const text = token.text || '';
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: parseInlineText(text) }
      } as BlockObjectRequest);
      break;
    }
    
    case 'list': {
      const items = token.items || [];
      const ordered = token.ordered || false;
      
      for (const item of items) {
        const text = item.text || '';
        if (ordered) {
          blocks.push({
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: { rich_text: parseInlineText(text) }
          } as BlockObjectRequest);
        } else {
          blocks.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: parseInlineText(text) }
          } as BlockObjectRequest);
        }
      }
      break;
    }
    
    case 'code': {
      const text = token.text || '';
      const lang = (token.lang || 'plain text').toLowerCase();
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: createRichText(text),
          language: lang as 'plain text'
        }
      } as BlockObjectRequest);
      break;
    }
    
    case 'blockquote': {
      const text = token.text || '';
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: parseInlineText(text) }
      } as BlockObjectRequest);
      break;
    }
    
    case 'hr': {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      } as BlockObjectRequest);
      break;
    }
    
    case 'table': {
      const text = token.raw || '';
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: createRichText(text) }
      } as BlockObjectRequest);
      break;
    }
    
    case 'space':
      break;
      
    default: {
      if (token.text) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: parseInlineText(token.text) }
        } as BlockObjectRequest);
      }
    }
  }
  
  return blocks;
}

export function markdownToBlocks(content: string): BlockObjectRequest[] {
  const tokens = parseMarkdown(content);
  const blocks: BlockObjectRequest[] = [];
  
  for (const token of tokens) {
    blocks.push(...tokenToBlocks(token));
  }
  
  return blocks;
}
