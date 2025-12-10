/**
 * ContentExtractor - Single source of truth for clean content extraction
 * Prevents metadata contamination by strictly separating source content from metadata files
 */

export interface CleanContent {
  content: string;
  userAddedContent?: string; // Content from USER ADDED section
  sourceType: 'text' | 'csv' | null;
  hasMetadata: boolean;
  originalFilename?: string;
}

export class ContentExtractor {
  // File type patterns
  private static readonly FILE_PATTERNS = {
    SOURCE_DOCUMENTS: /\.(card|txt|csv)$/,
    METADATA_FILES: /\.(entity|relate|attrib|comment|kv)\.txt$/,
    CARD_FILES: /\.card\.txt$/
  } as const;

  // Content delimiters for card files
  private static readonly DELIMITERS = {
    ORIGINAL_START: '=== ORIGINAL CONTENT START ===',
    ORIGINAL_END: '=== ORIGINAL CONTENT END ===',
    USER_ADDED_START: '=== USER ADDED START ===',
    USER_ADDED_END: '=== USER ADDED END ===',
    METADATA_START: '=== ORCS METADATA START ===',
    METADATA_END: '=== ORCS METADATA END ==='
  } as const;

  /**
   * Extract clean content from any file type
   * Returns only source content, never metadata
   */
  static extractCleanContent(fileContent: string, filename: string): CleanContent {
    // CRITICAL: Never extract content from metadata files
    if (this.isMetadataFile(filename)) {
      console.warn(`Attempted to extract content from metadata file: ${filename}`);
      return {
        content: '',
        sourceType: null,
        hasMetadata: false
      };
    }

    // Handle card files - extract only original content section
    if (this.isCardFile(filename)) {
      return this.extractFromCard(fileContent, filename);
    }

    // Handle original files - use full content
    if (this.isOriginalFile(filename)) {
      return {
        content: fileContent.trim(),
        sourceType: this.getSourceType(filename),
        hasMetadata: false
      };
    }

    // Unknown file type - return empty with warning
    console.warn(`Unknown file type for content extraction: ${filename}`);
    return {
      content: '',
      sourceType: null,
      hasMetadata: false
    };
  }

  /**
   * Check if file is a source document (contains searchable content)
   */
  static isSourceFile(filename: string): boolean {
    return this.FILE_PATTERNS.SOURCE_DOCUMENTS.test(filename) && 
           !this.FILE_PATTERNS.METADATA_FILES.test(filename);
  }

  /**
   * Check if file is a metadata file (should never be searched or displayed as content)
   */
  static isMetadataFile(filename: string): boolean {
    return this.FILE_PATTERNS.METADATA_FILES.test(filename);
  }

  /**
   * Check if file is a card file
   */
  static isCardFile(filename: string): boolean {
    return this.FILE_PATTERNS.CARD_FILES.test(filename);
  }

  /**
   * Check if file is an original source file (txt/csv)
   */
  static isOriginalFile(filename: string): boolean {
    return /\.(txt|csv)$/.test(filename) && !this.isCardFile(filename) && !this.isMetadataFile(filename);
  }

  /**
   * Extract content from card file using delimiters
   */
  private static extractFromCard(cardContent: string, filename: string): CleanContent {
    const { ORIGINAL_START, ORIGINAL_END, USER_ADDED_START, USER_ADDED_END } = this.DELIMITERS;
    
    // Look for content between original content delimiters
    const originalMatch = cardContent.match(
      new RegExp(`${this.escapeRegExp(ORIGINAL_START)}\\n([\\s\\S]*?)\\n${this.escapeRegExp(ORIGINAL_END)}`)
    );
    
    // Look for content between user added delimiters
    const userAddedMatch = cardContent.match(
      new RegExp(`${this.escapeRegExp(USER_ADDED_START)}\\n([\\s\\S]*?)\\n${this.escapeRegExp(USER_ADDED_END)}`)
    );
    
    if (originalMatch) {
      const originalContent = originalMatch[1].trim();
      const userAddedContent = userAddedMatch ? userAddedMatch[1].trim() : undefined;
      const sourceInfo = this.extractSourceFileInfo(cardContent);
      
      return {
        content: originalContent,
        userAddedContent,
        sourceType: sourceInfo.type,
        hasMetadata: true,
        originalFilename: sourceInfo.filename
      };
    }
    
    // Fallback: if delimiters not found, return full content with warning
    console.warn(`Card file ${filename} missing content delimiters, using full content`);
    return {
      content: cardContent.trim(),
      sourceType: this.getSourceType(filename),
      hasMetadata: true
    };
  }

  /**
   * Extract source file info from card metadata
   */
  private static extractSourceFileInfo(cardContent: string): { filename: string; type: 'text' | 'csv' | null } {
    const sourceFileMatch = cardContent.match(/source_file:\s*"([^"]+)"/);
    
    if (sourceFileMatch) {
      const filename = sourceFileMatch[1];
      const type = filename.endsWith('.csv') ? 'csv' : filename.endsWith('.txt') ? 'text' : null;
      return { filename, type };
    }
    
    return { filename: '', type: null };
  }

  /**
   * Determine source type from filename
   */
  private static getSourceType(filename: string): 'text' | 'csv' | null {
    if (filename.endsWith('.csv')) return 'csv';
    if (filename.endsWith('.txt')) return 'text';
    return null;
  }

  /**
   * Escape special regex characters
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate content extraction result
   */
  static validateCleanContent(result: CleanContent, filename: string): boolean {
    // Check for metadata contamination
    const hasUUIDs = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(result.content);
    const hasYAML = /^[a-z_]+:\s/m.test(result.content);
    const hasTimestamps = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i.test(result.content);
    
    if (hasUUIDs || hasYAML || hasTimestamps) {
      console.error(`Metadata contamination detected in clean content for ${filename}:`, {
        hasUUIDs,
        hasYAML,
        hasTimestamps
      });
      return false;
    }
    
    return true;
  }

  /**
   * Strip markdown-style tags from content to get plain text
   * Removes patterns like [entity:Name](uuid) and [relationship:label](uuid)
   */
  static stripTagsFromContent(content: string): string {
    // Pattern matches [type:text](uuid) and extracts just the text
    const tagPattern = /\[(entity|relationship|attribute|comment|kv):([^\]]+)\]\([a-f0-9-]+\)/gi;
    return content.replace(tagPattern, '$2');
  }

  /**
   * Compare card content (with tags stripped) against original source content
   * Returns details about any mismatches found
   */
  static compareContentIntegrity(cardContent: string, originalContent: string): ContentIntegrityResult {
    const strippedCardContent = this.stripTagsFromContent(cardContent);
    
    // Normalize whitespace for comparison
    const normalizedCard = strippedCardContent.replace(/\s+/g, ' ').trim();
    const normalizedOriginal = originalContent.replace(/\s+/g, ' ').trim();
    
    if (normalizedCard === normalizedOriginal) {
      return {
        isValid: true,
        missingText: [],
        extraText: []
      };
    }
    
    // Find missing words/phrases from the original
    const originalWords = normalizedOriginal.split(/\s+/);
    const cardWords = normalizedCard.split(/\s+/);
    const originalWordSet = new Set(originalWords);
    const cardWordSet = new Set(cardWords);
    
    const missingText: string[] = [];
    const extraText: string[] = [];
    
    originalWords.forEach(word => {
      if (!cardWordSet.has(word) && word.length > 2 && !missingText.includes(word)) {
        missingText.push(word);
      }
    });
    
    cardWords.forEach(word => {
      if (!originalWordSet.has(word) && word.length > 2 && !extraText.includes(word)) {
        extraText.push(word);
      }
    });
    
    return {
      isValid: false,
      missingText,
      extraText,
      originalContent: normalizedOriginal,
      cardContent: normalizedCard
    };
  }
}

export interface ContentIntegrityResult {
  isValid: boolean;
  missingText: string[];
  extraText: string[];
  originalContent?: string;
  cardContent?: string;
}