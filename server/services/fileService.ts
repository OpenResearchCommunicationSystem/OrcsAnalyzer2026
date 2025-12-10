import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { File, InsertFile, OrcsCard, InsertOrcsCard } from '@shared/schema';

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');
const RAW_DIR = path.join(USER_DATA_DIR, 'raw');
const CARDS_DIR = path.join(USER_DATA_DIR, 'cards');

/**
 * Generate a stable file ID based only on the file path (not modification time).
 * This ensures the ID remains consistent even when file content changes.
 */
export function generateStableFileId(filepath: string): string {
  const normalizedPath = path.relative(USER_DATA_DIR, filepath);
  return crypto.createHash('md5').update(normalizedPath).digest('hex');
}

export class FileService {
  async ensureDirectories(): Promise<void> {
    const dirs = [
      USER_DATA_DIR,
      RAW_DIR,
      CARDS_DIR,
      path.join(USER_DATA_DIR, 'entities'),
      path.join(USER_DATA_DIR, 'relationships'),
      path.join(USER_DATA_DIR, 'attributes'),
      path.join(USER_DATA_DIR, 'comments'),
      path.join(USER_DATA_DIR, 'kv_pairs'),
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  async saveUploadedFile(filename: string, content: Buffer): Promise<{ file: File, cardPath: string }> {
    await this.ensureDirectories();
    
    const sanitizedName = this.sanitizeFilename(filename);
    const filepath = path.join(RAW_DIR, sanitizedName);
    
    await fs.writeFile(filepath, content);
    
    const stats = await fs.stat(filepath);
    const id = generateStableFileId(filepath);
    
    const fileData: File = {
      id,
      name: sanitizedName,
      path: filepath,
      type: sanitizedName.endsWith('.csv') ? 'csv' : 'txt',
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
    };

    // Create companion ORCS card with embedded content
    const cardPath = await this.createMetadataFile(fileData, content.toString('utf-8'));
    
    return { file: fileData, cardPath };
  }

  async createMetadataFile(file: File, content: string): Promise<string> {
    const metadataId = uuidv4();
    const now = new Date().toISOString();
    const sourceHash = crypto.createHash('sha256').update(content).digest('hex');
    
    const baseName = path.parse(file.name).name;
    const metadataFilename = `${baseName}_${metadataId}.card.txt`;
    const metadataPath = path.join(RAW_DIR, metadataFilename);
    
    const cardContent = [
      '=== ORCS CARD ===',
      `version: "2025.003"`,
      `uuid: "${metadataId}"`,
      `source_file: "${file.name}"`,
      `source_reference: ""`,
      `classification: ""`,
      `handling:`,
      `  - ""`,
      `created: "${now}"`,
      `modified: "${now}"`,
      `source_hash: "sha256:${sourceHash}"`,
      `file_type: "${file.type}"`,
      `file_size: ${file.size}`,
      `analyst: ""`,
      ``,
      `=== TAG INDEX START ===`,
      ``,
      `=== TAG INDEX END ===`,
      ``,
      `=== ORIGINAL CONTENT START ===`,
      content,
      `=== ORIGINAL CONTENT END ===`,
      ``,
      `=== USER ADDED START ===`,
      ``,
      `=== USER ADDED END ===`,
    ].join('\n');
    
    await fs.writeFile(metadataPath, cardContent, 'utf-8');
    return metadataPath;
  }

  async getMetadataForFile(filename: string): Promise<string | null> {
    const baseName = path.parse(filename).name;
    
    // Wikipedia approach: Find the metadata file regardless of format
    const metadataFile = await this.findMetadataFile(baseName);
    if (!metadataFile) {
      return null;
    }
    
    try {
      const content = await fs.readFile(metadataFile.path, 'utf-8');
      
      // Auto-migrate old .yaml.txt files to new .card.txt format
      if (metadataFile.isLegacy) {
        await this.migrateMetadataFile(filename, metadataFile.path, content);
      }
      
      return content;
    } catch (error) {
      return null;
    }
  }

  private async findMetadataFile(baseName: string): Promise<{path: string, isLegacy: boolean} | null> {
    try {
      const files = await fs.readdir(RAW_DIR);
      
      // Look for new .card.txt format first
      for (const file of files) {
        if (file.startsWith(baseName) && file.endsWith('.card.txt')) {
          return { path: path.join(RAW_DIR, file), isLegacy: false };
        }
      }
      
      // Fallback to legacy .yaml.txt format
      const legacyFile = `${baseName}.yaml.txt`;
      const legacyPath = path.join(RAW_DIR, legacyFile);
      
      try {
        await fs.access(legacyPath);
        return { path: legacyPath, isLegacy: true };
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  private async migrateMetadataFile(originalFilename: string, oldPath: string, content: string): Promise<void> {
    try {
      const baseName = path.parse(originalFilename).name;
      
      // Check if ANY .card.txt file already exists for this base name
      try {
        const files = await fs.readdir(RAW_DIR);
        const existingCardFile = files.find(file => 
          file.startsWith(baseName) && file.endsWith('.card.txt')
        );
        
        if (existingCardFile) {
          // Card file already exists, just remove old .yaml.txt file
          await fs.unlink(oldPath);
          console.log(`Removed legacy file: ${path.basename(oldPath)} (card file already exists)`);
          return;
        }
      } catch {
        // Directory read failed, proceed with migration
      }
      
      // Create new card file
      const metadataId = uuidv4();
      const newFilename = `${baseName}_${metadataId}.card.txt`;
      const newPath = path.join(RAW_DIR, newFilename);
      
      // Update the UUID in the content
      const updatedContent = content.replace(/uuid: "[^"]*"/, `uuid: "${metadataId}"`);
      
      // Save with new format
      await fs.writeFile(newPath, updatedContent, 'utf-8');
      
      // Remove old file
      await fs.unlink(oldPath);
      
      console.log(`Migrated metadata file: ${path.basename(oldPath)} -> ${newFilename}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to migrate metadata file ${oldPath}:`, error);
      }
    }
  }

  async updateMetadataFile(filename: string, content: string): Promise<void> {
    const baseName = path.parse(filename).name;
    
    // Find existing metadata file using Wikipedia approach
    const metadataFile = await this.findMetadataFile(baseName);
    if (metadataFile) {
      // Update existing file
      await fs.writeFile(metadataFile.path, content, 'utf-8');
    } else {
      // Create new metadata file with UUID
      const metadataId = uuidv4();
      const newFilename = `${baseName}_${metadataId}.card.txt`;
      const newPath = path.join(RAW_DIR, newFilename);
      await fs.writeFile(newPath, content, 'utf-8');
    }
  }

  // Update only the metadata fields while preserving ORIGINAL CONTENT and USER ADDED sections
  async updateCardMetadata(filename: string, metadata: {
    source_reference?: string;
    classification?: string;
    handling?: string[];
    analyst?: string;
  }): Promise<void> {
    const baseName = path.parse(filename).name;
    
    const metadataFile = await this.findMetadataFile(baseName);
    if (!metadataFile) {
      throw new Error(`Card file not found for: ${filename}`);
    }
    
    // Read the existing card file
    const existingContent = await fs.readFile(metadataFile.path, 'utf-8');
    
    // Split the file into sections to safely preserve content
    const tagIndexStart = existingContent.indexOf('=== TAG INDEX START ===');
    const originalContentStart = existingContent.indexOf('=== ORIGINAL CONTENT START ===');
    const userAddedStart = existingContent.indexOf('=== USER ADDED START ===');
    
    // If the card has the expected structure, parse header and preserve content
    if (tagIndexStart > 0 && originalContentStart > 0) {
      // Extract header (before TAG INDEX)
      let header = existingContent.substring(0, tagIndexStart);
      
      // Extract everything from TAG INDEX onwards (content we must preserve)
      const preservedContent = existingContent.substring(tagIndexStart);
      
      // Update header fields only
      if (metadata.source_reference !== undefined) {
        header = header.replace(
          /^source_reference:\s*"[^"]*"/m,
          `source_reference: "${metadata.source_reference}"`
        );
      }
      
      if (metadata.classification !== undefined) {
        header = header.replace(
          /^classification:\s*"[^"]*"/m,
          `classification: "${metadata.classification}"`
        );
      }
      
      if (metadata.analyst !== undefined) {
        header = header.replace(
          /^analyst:\s*"[^"]*"/m,
          `analyst: "${metadata.analyst}"`
        );
      }
      
      if (metadata.handling !== undefined && metadata.handling.length > 0) {
        // Match handling section including all indented lines that follow
        const handlingRegex = /^handling:\n((?:[ \t]+-[^\n]*\n?)*)/m;
        const newHandling = `handling:\n${metadata.handling.map(h => `  - "${h}"`).join('\n')}\n`;
        header = header.replace(handlingRegex, newHandling);
      }
      
      // Update modified timestamp
      const now = new Date().toISOString();
      header = header.replace(
        /^modified:\s*"[^"]*"/m,
        `modified: "${now}"`
      );
      
      // Reconstruct the file with updated header and preserved content
      const updatedContent = header + preservedContent;
      await fs.writeFile(metadataFile.path, updatedContent, 'utf-8');
    } else {
      // Fallback for cards without expected structure - update in place
      let updatedContent = existingContent;
      
      if (metadata.source_reference !== undefined) {
        updatedContent = updatedContent.replace(
          /^source_reference:\s*"[^"]*"/m,
          `source_reference: "${metadata.source_reference}"`
        );
      }
      
      if (metadata.classification !== undefined) {
        updatedContent = updatedContent.replace(
          /^classification:\s*"[^"]*"/m,
          `classification: "${metadata.classification}"`
        );
      }
      
      if (metadata.analyst !== undefined) {
        updatedContent = updatedContent.replace(
          /^analyst:\s*"[^"]*"/m,
          `analyst: "${metadata.analyst}"`
        );
      }
      
      if (metadata.handling !== undefined && metadata.handling.length > 0) {
        const handlingRegex = /^handling:\n((?:[ \t]+-[^\n]*\n?)*)/m;
        const newHandling = `handling:\n${metadata.handling.map(h => `  - "${h}"`).join('\n')}\n`;
        updatedContent = updatedContent.replace(handlingRegex, newHandling);
      }
      
      const now = new Date().toISOString();
      updatedContent = updatedContent.replace(
        /^modified:\s*"[^"]*"/m,
        `modified: "${now}"`
      );
      
      await fs.writeFile(metadataFile.path, updatedContent, 'utf-8');
    }
  }

  private formatOrcsCard(card: OrcsCard): string {
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

  async getFiles(): Promise<File[]> {
    await this.ensureDirectories();
    
    try {
      const files: File[] = [];
      
      // Scan raw directory for main files and cards
      const rawFiles = await fs.readdir(RAW_DIR);
      for (const filename of rawFiles) {
        if (filename === '.gitkeep') continue;
        
        const filepath = path.join(RAW_DIR, filename);
        const stats = await fs.stat(filepath);
        
        const id = generateStableFileId(filepath);
        
        // Extract cardUuid for card files
        let cardUuid: string | undefined;
        if (filename.endsWith('.card.txt')) {
          try {
            const content = await fs.readFile(filepath, 'utf-8');
            const uuidMatch = content.match(/^uuid:\s*"([^"]+)"/m);
            if (uuidMatch) {
              cardUuid = uuidMatch[1];
            }
          } catch (e) {
            // Ignore errors reading UUID
          }
        }
        
        files.push({
          id,
          name: filename,
          path: filepath,
          type: filename.endsWith('.csv') ? 'csv' : (filename.endsWith('.yaml.txt') || filename.endsWith('.card.txt')) ? 'metadata' : 'txt',
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          ...(cardUuid && { cardUuid }),
        });
      }
      
      // Recursively scan all directories for tag files (location-agnostic)
      await this.scanForTagFiles(files, process.cwd() + '/user_data');
      
      return files;
    } catch (error) {
      return [];
    }
  }

  async getFileContent(filepath: string): Promise<string> {
    try {
      return await fs.readFile(filepath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${filepath}`);
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const files = await this.getFiles();
      const fileToDelete = files.find(f => f.id === fileId);
      
      if (!fileToDelete) {
        return false;
      }

      // Delete the actual file
      await fs.unlink(fileToDelete.path);
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  /**
   * Cascade delete: deletes both the original file and its companion card file.
   * Returns info about what was deleted for index and tag cleanup.
   * Uses both index lookup AND filesystem fallback to ensure both files are found.
   */
  async deleteDocumentCascade(fileId: string, indexedFiles: Array<{
    id: string;
    path: string;
    name: string;
    type: string;
    cardUuid?: string;
    sourceFile?: string;
  }>): Promise<{
    success: boolean;
    deletedPaths: string[];
    cardUuid?: string;
    cardFilename?: string;
  }> {
    try {
      const fileToDelete = indexedFiles.find(f => f.id === fileId);
      
      if (!fileToDelete) {
        return { success: false, deletedPaths: [] };
      }

      const deletedPaths: string[] = [];
      let cardUuid: string | undefined;
      let cardFilename: string | undefined;

      // Case 1: Deleting a card file - find and delete the original too
      if (fileToDelete.type === 'orcs_card' && fileToDelete.cardUuid) {
        cardUuid = fileToDelete.cardUuid;
        cardFilename = fileToDelete.name;
        
        // Delete the card file
        await fs.unlink(fileToDelete.path);
        deletedPaths.push(fileToDelete.path);
        
        // Find the original file - try index first, then filesystem fallback
        let originalPath: string | null = null;
        
        if (fileToDelete.sourceFile) {
          // Try index lookup
          const originalFile = indexedFiles.find(f => 
            f.name === fileToDelete.sourceFile && f.type !== 'orcs_card'
          );
          if (originalFile) {
            originalPath = originalFile.path;
          } else {
            // Filesystem fallback - check RAW_DIR directly
            const possiblePath = path.join(RAW_DIR, fileToDelete.sourceFile);
            try {
              await fs.access(possiblePath);
              originalPath = possiblePath;
            } catch {
              // Original file doesn't exist on disk - this is acceptable
              // (may have been manually deleted or was never created)
              console.log(`[DELETE] Original file not found: ${fileToDelete.sourceFile}`);
            }
          }
        }
        
        if (originalPath) {
          await fs.unlink(originalPath);
          deletedPaths.push(originalPath);
        }
      }
      // Case 2: Deleting an original file - find and delete the card too
      else if (fileToDelete.type === 'txt' || fileToDelete.type === 'csv') {
        // Delete the original file
        await fs.unlink(fileToDelete.path);
        deletedPaths.push(fileToDelete.path);
        
        // Find the companion card - try index first, then filesystem fallback
        let cardPath: string | null = null;
        
        // Try index lookup
        const companionCard = indexedFiles.find(f => 
          f.type === 'orcs_card' && f.sourceFile === fileToDelete.name
        );
        if (companionCard) {
          cardPath = companionCard.path;
          cardUuid = companionCard.cardUuid;
          cardFilename = companionCard.name;
        } else {
          // Filesystem fallback - scan RAW_DIR for matching card files
          const baseName = path.parse(fileToDelete.name).name;
          const rawFiles = await fs.readdir(RAW_DIR);
          for (const file of rawFiles) {
            // Match pattern: basename_uuid.card.txt
            if (file.startsWith(baseName + '_') && file.endsWith('.card.txt')) {
              cardPath = path.join(RAW_DIR, file);
              cardFilename = file;
              // Extract UUID from filename
              const uuidMatch = file.match(/_([a-f0-9-]+)\.card\.txt$/);
              if (uuidMatch) {
                cardUuid = uuidMatch[1];
              }
              break;
            }
          }
        }
        
        if (cardPath) {
          await fs.unlink(cardPath);
          deletedPaths.push(cardPath);
        } else {
          // No companion card found - log but don't fail (card may have been deleted separately)
          console.log(`[DELETE] No companion card found for: ${fileToDelete.name}`);
        }
      }
      // Case 3: Deleting a tag file or other file type - just delete it
      else {
        await fs.unlink(fileToDelete.path);
        deletedPaths.push(fileToDelete.path);
      }

      return {
        success: deletedPaths.length > 0,
        deletedPaths,
        cardUuid,
        cardFilename,
      };
    } catch (error) {
      console.error('Cascade deletion error:', error);
      return { success: false, deletedPaths: [] };
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9.-]/gi, '_');
  }

  // Recursively scan directories for tag files (location-agnostic approach)
  private async scanForTagFiles(files: File[], directory: string): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === '.gitkeep') continue;
        
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanForTagFiles(files, fullPath);
        } else if (entry.isFile()) {
          // Check if file matches tag file patterns
          const tagType = this.getFileTagType(entry.name);
          if (tagType) {
            const stats = await fs.stat(fullPath);
            const id = generateStableFileId(fullPath);
            
            files.push({
              id,
              name: entry.name,
              path: fullPath,
              type: tagType,
              size: stats.size,
              created: stats.birthtime.toISOString(),
              modified: stats.mtime.toISOString(),
            });
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  // Determine tag type from filename
  private getFileTagType(filename: string): 'entity' | 'relationship' | 'attribute' | 'comment' | 'kv_pair' | null {
    if (filename.endsWith('.entity.txt')) return 'entity';
    if (filename.endsWith('.relate.txt')) return 'relationship';
    if (filename.endsWith('.attrib.txt')) return 'attribute';
    if (filename.endsWith('.comment.txt')) return 'comment';
    if (filename.endsWith('.kv.txt')) return 'kv_pair';
    return null;
  }
}

export const fileService = new FileService();
