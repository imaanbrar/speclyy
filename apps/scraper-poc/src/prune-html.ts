export function pruneHtml(html: string, maxChars: number): string {
  const cleaned = html
    // Structural noise — irrelevant to product extraction.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    // Framework noise — CSS-in-JS class names and data-* attrs tokenize badly.
    .replace(/\sclass=(['"])[\s\S]*?\1/gi, '')
    .replace(/\sstyle=(['"])[\s\S]*?\1/gi, '')
    .replace(/\sdata-[a-z0-9-]+=(['"])[\s\S]*?\1/gi, '')
    .replace(/\son[a-z]+=(['"])[\s\S]*?\1/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned
}
