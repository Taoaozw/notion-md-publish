const MAX_TITLE_LENGTH = 80;

export function extractH1(markdown: string): string | null {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2);
    }
  }
  return null;
}

export function sanitizeTitle(rawTitle: string): string {
  let title = rawTitle;
  
  title = title.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  title = title.replace(/\*\*([^*]*)\*\*/g, '$1');
  title = title.replace(/\*([^*]*)\*/g, '$1');
  title = title.replace(/__([^_]*)__/g, '$1');
  title = title.replace(/_([^_]*)_/g, '$1');
  title = title.replace(/`([^`]*)`/g, '$1');
  title = title.replace(/~~([^~]*)~~/g, '$1');
  
  title = title.replace(/\s+/g, ' ').trim();
  
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.slice(0, MAX_TITLE_LENGTH - 1) + '…';
  }
  
  return title;
}

export function getPageTitle(markdown: string, fallbackName: string): string {
  const h1 = extractH1(markdown);
  if (h1) {
    return sanitizeTitle(h1);
  }
  return sanitizeTitle(fallbackName);
}
