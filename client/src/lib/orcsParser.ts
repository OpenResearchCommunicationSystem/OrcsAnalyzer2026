import { OrcsCard } from "@shared/schema";

export function parseOrcsCard(content: string): OrcsCard | null {
  const lines = content.split('\n');
  const card: Partial<OrcsCard> = {
    keyValuePairs: {},
    handling: [],
    tags: [],
  };

  let currentSection = '';
  let contentLines: string[] = [];
  let inContent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('=== CLASSIFICATION:')) {
      card.classification = trimmed.replace('=== CLASSIFICATION:', '').replace('===', '').trim();
    } else if (trimmed.startsWith('=== HANDLING:')) {
      const handling = trimmed.replace('=== HANDLING:', '').replace('===', '').trim();
      card.handling!.push(handling);
    } else if (trimmed.startsWith('UUID:')) {
      card.id = trimmed.substring(5).trim();
    } else if (trimmed.startsWith('TITLE:')) {
      card.title = trimmed.substring(6).trim();
    } else if (trimmed.startsWith('SOURCE:')) {
      card.source = trimmed.substring(7).trim();
    } else if (trimmed.startsWith('SOURCE_HASH:')) {
      card.sourceHash = trimmed.substring(12).trim();
    } else if (trimmed.startsWith('CITATION:')) {
      card.citation = trimmed.substring(9).trim();
    } else if (trimmed.startsWith('CREATED:')) {
      card.created = trimmed.substring(8).trim();
    } else if (trimmed.startsWith('MODIFIED:')) {
      card.modified = trimmed.substring(9).trim();
    } else if (trimmed === 'KEYVALUE_PAIRS:') {
      currentSection = 'kvp';
    } else if (trimmed === 'CONTENT:') {
      currentSection = 'content';
      inContent = true;
    } else if (trimmed === 'TAGS:') {
      currentSection = 'tags';
      inContent = false;
    } else if (trimmed.startsWith('=== END')) {
      break;
    } else if (currentSection === 'kvp' && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      card.keyValuePairs![key.trim()] = valueParts.join(':').trim();
    } else if (currentSection === 'tags' && trimmed.startsWith('tag_ref:')) {
      card.tags!.push(trimmed.substring(8).trim());
    } else if (inContent && currentSection === 'content') {
      contentLines.push(line);
    }
  }

  if (contentLines.length > 0) {
    card.content = contentLines.join('\n').trim();
  }

  // Validate required fields
  if (card.id && card.title && card.source && card.created && card.modified && card.content) {
    return card as OrcsCard;
  }
  
  return null;
}

export function formatOrcsCard(card: OrcsCard): string {
  const lines = [
    '=== CLASSIFICATION: ' + card.classification + ' ===',
    ...card.handling.map(h => '=== HANDLING: ' + h + ' ==='),
    '=== ORCS FORMAT VERSION: 2025.003 ===',
    'UUID: ' + card.id,
    'TITLE: ' + card.title,
    'SOURCE: ' + card.source,
    'SOURCE_HASH: ' + card.sourceHash,
    'CITATION: ' + card.citation,
    'CREATED: ' + card.created,
    'MODIFIED: ' + card.modified,
    '',
    'KEYVALUE_PAIRS:',
    ...Object.entries(card.keyValuePairs).map(([k, v]) => `${k}: ${v}`),
    '',
    'CONTENT:',
    card.content,
    '',
    'TAGS:',
    ...card.tags.map(tagId => `tag_ref: ${tagId}`),
    '',
    '=== END HANDLING: ' + card.handling[card.handling.length - 1] + ' ===',
    '=== END ORCS FORMAT VERSION: 2025.003 ===',
    '=== END CLASSIFICATION: ' + card.classification + ' ===',
    '',
  ];
  
  return lines.join('\n');
}
