import { marked } from 'marked';

export interface ParsedToken {
  type: string;
  raw: string;
  text?: string;
  depth?: number;
  lang?: string;
  items?: ParsedToken[];
  ordered?: boolean;
}

export function parseMarkdown(content: string): ParsedToken[] {
  const tokens = marked.lexer(content);
  return tokens as ParsedToken[];
}

export function getMarkdownContent(content: string): string {
  return content;
}
