/**
 * Wiki-Link Parser for ORCS v2
 * 
 * Parses tri-part wiki-link syntax: [[type:normalized|display]]
 * 
 * Parsing Rules:
 * 1. [[value]] → Entity with inferred type, value is both canonical and display
 * 2. [[type:value]] → Entity with explicit type, value is both canonical and display
 * 3. [[type:canonical|display]] → Entity with type, normalized value, and display alias
 */

export interface ParsedWikiLink {
  type: string;           // Entity type (person, org, location, selector, date, or inferred)
  canonicalName: string;  // Normalized value
  displayName: string;    // Display text (original text from source)
  fullMatch: string;      // The full [[...]] string for replacement
  startIndex: number;     // Start position in source text
  endIndex: number;       // End position in source text
}

// Known entity types for type inference
const KNOWN_TYPES = ['person', 'org', 'organization', 'location', 'selector', 'date', 'event', 'document'];

// Regex to match wiki-links: [[...]]
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Parse a single wiki-link content (without the brackets)
 */
function parseWikiLinkContent(content: string): { type: string; canonicalName: string; displayName: string } {
  // Check for display separator |
  const pipeIndex = content.indexOf('|');
  let displayName: string;
  let mainPart: string;
  
  if (pipeIndex !== -1) {
    // Has display text: [[....|display]]
    mainPart = content.substring(0, pipeIndex);
    displayName = content.substring(pipeIndex + 1);
  } else {
    // No display text, use canonical as display
    mainPart = content;
    displayName = content;
  }
  
  // Check for type prefix :
  const colonIndex = mainPart.indexOf(':');
  let type: string;
  let canonicalName: string;
  
  if (colonIndex !== -1) {
    // Has explicit type: [[type:canonical...]]
    type = mainPart.substring(0, colonIndex).toLowerCase();
    canonicalName = mainPart.substring(colonIndex + 1);
    
    // If no display was specified, use canonical
    if (pipeIndex === -1) {
      displayName = canonicalName;
    }
  } else {
    // No type specified, infer from content or use 'entity'
    canonicalName = mainPart;
    type = inferEntityType(canonicalName);
    
    // If no display was specified, use canonical
    if (pipeIndex === -1) {
      displayName = canonicalName;
    }
  }
  
  return { type, canonicalName, displayName };
}

/**
 * Infer entity type from content
 */
function inferEntityType(value: string): string {
  // Phone number patterns
  if (/^[+\d\s\-()]+$/.test(value) && value.replace(/\D/g, '').length >= 7) {
    return 'selector';
  }
  
  // Email pattern
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'selector';
  }
  
  // Date patterns (ISO, common formats)
  if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) {
    return 'date';
  }
  
  // Default to generic entity
  return 'entity';
}

/**
 * Parse all wiki-links from text
 */
export function parseWikiLinks(text: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  let match: RegExpExecArray | null;
  
  // Reset regex state
  WIKI_LINK_REGEX.lastIndex = 0;
  
  while ((match = WIKI_LINK_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;
    
    const parsed = parseWikiLinkContent(content);
    
    links.push({
      ...parsed,
      fullMatch,
      startIndex,
      endIndex
    });
  }
  
  return links;
}

/**
 * Convert text with wiki-links to plain text (display only)
 */
export function wikiLinksToPlainText(text: string): string {
  return text.replace(WIKI_LINK_REGEX, (match, content) => {
    const parsed = parseWikiLinkContent(content);
    return parsed.displayName;
  });
}

/**
 * Convert text with wiki-links to HTML with highlighting
 */
export function wikiLinksToHtml(text: string, options?: { 
  classPrefix?: string;
  entityOnClick?: boolean;
}): string {
  const { classPrefix = 'wiki-link', entityOnClick = true } = options || {};
  
  return text.replace(WIKI_LINK_REGEX, (match, content) => {
    const parsed = parseWikiLinkContent(content);
    const typeClass = `${classPrefix}-${parsed.type}`;
    const dataAttrs = entityOnClick 
      ? `data-entity-type="${parsed.type}" data-canonical="${encodeURIComponent(parsed.canonicalName)}"` 
      : '';
    
    return `<span class="${classPrefix} ${typeClass}" ${dataAttrs} title="${parsed.canonicalName}">${parsed.displayName}</span>`;
  });
}

/**
 * Create a wiki-link string from components
 */
export function createWikiLink(type: string, canonicalName: string, displayName?: string): string {
  if (displayName && displayName !== canonicalName) {
    return `[[${type}:${canonicalName}|${displayName}]]`;
  }
  return `[[${type}:${canonicalName}]]`;
}

/**
 * Validate wiki-link syntax
 */
export function isValidWikiLink(text: string): boolean {
  const regex = /^\[\[[^\]]+\]\]$/;
  return regex.test(text);
}

/**
 * Extract entity type from wiki-link or return null if invalid
 */
export function extractEntityType(wikiLink: string): string | null {
  if (!isValidWikiLink(wikiLink)) {
    return null;
  }
  
  const content = wikiLink.slice(2, -2); // Remove [[ and ]]
  const colonIndex = content.indexOf(':');
  
  if (colonIndex !== -1) {
    return content.substring(0, colonIndex).toLowerCase();
  }
  
  // Infer type
  const pipeIndex = content.indexOf('|');
  const value = pipeIndex !== -1 ? content.substring(0, pipeIndex) : content;
  return inferEntityType(value);
}
