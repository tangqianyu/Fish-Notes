/**
 * Extract title from HTML content.
 * Looks for the first <h1>, falls back to first element text, then plain text.
 */
export function extractTitle(html: string): string {
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].replace(/<[^>]*>/g, '').trim() || '无标题';
  }
  const firstTagMatch = html.match(/<(?:p|h[1-6]|div)[^>]*>(.*?)<\/(?:p|h[1-6]|div)>/i);
  if (firstTagMatch) {
    return firstTagMatch[1].replace(/<[^>]*>/g, '').trim() || '无标题';
  }
  return stripHtml(html).split('\n')[0]?.trim() || '无标题';
}

/**
 * Strip HTML tags and decode common entities, returning plain text.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
