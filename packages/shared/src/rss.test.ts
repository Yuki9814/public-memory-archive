import assert from "node:assert/strict";
import test from "node:test";
import { buildRssFeed, escapeXml, type RssItem } from "./rss.js";

test("escapeXml escapes XML special characters", () => {
  assert.equal(escapeXml("a&b<c>d\"e'f"), "a&amp;b&lt;c&gt;d&quot;e&apos;f");
  assert.equal(escapeXml("already &amp;"), "already &amp;amp;");
});

test("escapeXml strips invalid XML 1.0 control characters", () => {
  const input = "Valid\x09TAB\x0ALF\x0DCR and Invalid\x00Null\x01SOH\x08BS\x0BVT\x0CFF\x0EShiftIn\x1FUnitSep";
  const expected = "Valid\x09TAB\x0ALF\x0DCR and InvalidNullSOHBSVTFFShiftInUnitSep";

  assert.equal(escapeXml(input), expected);
});

test("escapeXml leaves plain text and safe punctuation unchanged", () => {
  assert.equal(escapeXml("hello world 123 - foo.bar?"), "hello world 123 - foo.bar?");
  assert.equal(escapeXml(""), "");
});

test("buildRssFeed escapes content fields and is deterministic", () => {
  const input = {
    title: "Feed & Title <x>",
    link: "https://ex.com/?q=1<2",
    description: "Desc with \"quotes\" & 'apostrophe' <tag>",
    items: [
      {
        title: "Item <1> & \"2\"",
        link: "https://ex.com/i?x=1<2",
        description: "d & d < > ' \"",
        pubDate: new Date("2025-05-01T12:00:00Z"),
        guid: "event:123<>&\"'"
      }
    ] as RssItem[]
  };

  const xml1 = buildRssFeed(input);
  const xml2 = buildRssFeed(input);

  assert.equal(xml1, xml2);
  assert.ok(xml1.includes("<title>Feed &amp; Title &lt;x&gt;</title>"));
  assert.ok(
    xml1.includes(
      "<description>Desc with &quot;quotes&quot; &amp; &apos;apostrophe&apos; &lt;tag&gt;</description>"
    )
  );
  assert.ok(xml1.includes("<guid>event:123&lt;&gt;&amp;&quot;&apos;</guid>"));
});

test("buildRssFeed preserves item order and handles empty item lists", () => {
  const items: RssItem[] = [
    { title: "A", link: "l1", description: "d1", pubDate: new Date(0), guid: "g1" },
    { title: "B", link: "l2", description: "d2", pubDate: new Date(1), guid: "g2" }
  ];
  const xml = buildRssFeed({ title: "t", link: "l", description: "d", items });
  const posA = xml.indexOf("<title>A</title>");
  const posB = xml.indexOf("<title>B</title>");

  assert.ok(posA > 0 && posB > 0 && posA < posB);

  const emptyXml = buildRssFeed({ title: "t", link: "l", description: "d", items: [] });
  assert.ok(emptyXml.includes("<description>d</description>\n  </channel>"));
  assert.ok(emptyXml.includes("</rss>"));
});

test("buildRssFeed uses UTC strings for pubDate", () => {
  const xml = buildRssFeed({
    title: "t",
    link: "l",
    description: "d",
    items: [
      {
        title: "i",
        link: "l",
        description: "d",
        pubDate: new Date("2020-01-01T00:00:00Z"),
        guid: "g"
      }
    ] as RssItem[]
  });

  assert.ok(xml.includes("<pubDate>Wed, 01 Jan 2020 00:00:00 GMT</pubDate>"));
});
