export function escapeXml(value: string): string {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  guid: string;
}

export function buildRssFeed(input: {
  title: string;
  link: string;
  description: string;
  items: RssItem[];
}): string {
  const items = input.items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <guid>${escapeXml(item.guid)}</guid>
    </item>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(input.title)}</title>
    <link>${escapeXml(input.link)}</link>
    <description>${escapeXml(input.description)}</description>${items}
  </channel>
</rss>`;
}
