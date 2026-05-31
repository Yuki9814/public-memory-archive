const incitingTerms = [
  "捞女",
  "渣男",
  "女拳",
  "拳师",
  "龟男",
  "小仙女",
  "集美",
  "蝈男",
  "开盒",
  "人肉",
  "挂人",
  "去冲",
  "围剿",
  "实锤死刑"
];

const sensitivePatterns = [
  { code: "PHONE", pattern: /(?<!\d)(?:1[3-9]\d{9})(?!\d)/ },
  { code: "ID_CARD", pattern: /(?<!\d)(?:\d{17}[\dXx]|\d{15})(?!\d)/ },
  {
    code: "ADDRESS",
    pattern: /(?:省|市|区|县|镇|街道|小区|单元|门牌|栋|室).{0,18}\d{1,4}(?:号|室|栋|单元)/
  }
];

export function findIncitingTerms(text: string): string[] {
  const normalized = text.toLowerCase();
  return incitingTerms.filter((term) => normalized.includes(term.toLowerCase()));
}

export function containsSensitivePersonalInfo(text: string): boolean {
  return sensitivePatterns.some((entry) => entry.pattern.test(text));
}

export function describeSensitiveHits(text: string): string[] {
  return sensitivePatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => entry.code);
}
