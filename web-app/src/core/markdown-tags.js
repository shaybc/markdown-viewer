export function normalizeTagName(tag) {
  return String(tag || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function collectNormalizedTags(tags, values) {
  values.forEach((value) => {
    if (Array.isArray(value)) {
      collectNormalizedTags(tags, value);
      return;
    }

    const normalized = normalizeTagName(value);
    if (normalized) tags.add(normalized);
  });
}

export function normalizeFileTagList(tags) {
  const normalizedTags = [];
  const seenTags = new Set();

  (Array.isArray(tags) ? tags : [tags]).forEach((tag) => {
    const normalizedTag = normalizeTagName(tag);
    if (!normalizedTag || seenTags.has(normalizedTag)) return;
    seenTags.add(normalizedTag);
    normalizedTags.push(normalizedTag);
  });

  return normalizedTags;
}
