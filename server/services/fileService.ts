import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { File, InsertFile, OrcsCard, InsertOrcsCard } from '@shared/schema';

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');
const RAW_DIR = path.join(USER_DATA_DIR, 'raw');
const CARDS_DIR = path.join(USER_DATA_DIR, 'cards');

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

  async saveUploadedFile(filename: string, content: Buffer): Promise<File> {
    await this.ensureDirectories();
    
    const sanitizedName = this.sanitizeFilename(filename);
    const filepath = path.join(RAW_DIR, sanitizedName);
    
    await fs.writeFile(filepath, content);
    
    const stats = await fs.stat(filepath);
    const id = crypto.createHash('md5').update(`${filepath}-${stats.mtime.getTime()}`).digest('hex');
    
    const fileData: File = {
      id,
      name: sanitizedName,
      path: filepath,
      type: sanitizedName.endsWith('.csv') ? 'csv' : 'txt',
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
    };

    // Create companion metadata file
    await this.createMetadataFile(fileData, content.toString('utf-8'));
    
    return fileData;
  }

  async createMetadataFile(file: File, content: string): Promise<void> {
    const metadataId = uuidv4();
    const now = new Date().toISOString();
    const sourceHash = crypto.createHash('sha256').update(content).digest('hex');
    
    const baseName = path.parse(file.name).name;
    const metadataFilename = `${baseName}_${metadataId}.card.txt`;
    const metadataPath = path.join(RAW_DIR, metadataFilename);
    
    const yamlContent = [
      '# ORCS Metadata Card',
      `version: "2025.003"`,
      `uuid: "${metadataId}"`,
      `source_file: "${file.name}"`,
      `source_reference: ""  # External URL or reference`,
      `classification: "Proprietary Information"`,
      `handling:`,
      `  - "Copyright 2025 TechWatch Intelligence"`,
      `  - "Distribution: Internal Use Only"`,
      `created: "${now}"`,
      `modified: "${now}"`,
      `source_hash: "sha256:${sourceHash}"`,
      ``,
      `metadata:`,
      `  file_type: "${file.type}"`,
      `  file_size: ${file.size}`,
      `  analyst: ""`,
      `  confidence: ""`,
      ``,
      `tag_index: []`,
      `  # Tags will be added here as:`,
      `  # - id: "tag_id"`,
      `  #   type: "entity"`,
      `  #   name: "TagName"`,
      `  #   reference: "${file.name}[row,col]"`,
      ``
    ].join('\n');
    
    await fs.writeFile(metadataPath, yamlContent, 'utf-8');
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
      const rawFiles = await fs.readdir(RAW_DIR);
      const files: File[] = [];
      
      // Process all files including metadata files
      for (const filename of rawFiles) {
        if (filename === '.gitkeep') continue;
        
        const filepath = path.join(RAW_DIR, filename);
        const stats = await fs.stat(filepath);
        
        // Use a consistent ID based on file path and modified time
        const id = crypto.createHash('md5').update(`${filepath}-${stats.mtime.getTime()}`).digest('hex');
        
        files.push({
          id,
          name: filename,
          path: filepath,
          type: filename.endsWith('.csv') ? 'csv' : (filename.endsWith('.yaml.txt') || filename.endsWith('.card.txt')) ? 'metadata' : 'txt',
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        });
      }
      
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
      
      // If it's a raw file, also delete the corresponding ORCS card
      if (fileToDelete.type === 'txt' || fileToDelete.type === 'csv') {
        const cardFilename = `${path.parse(fileToDelete.name).name}_ORCS_CARD.txt`;
        const cardPath = path.join(CARDS_DIR, cardFilename);
        
        try {
          await fs.unlink(cardPath);
        } catch (error) {
          // Card might not exist, continue anyway
        }
      }
      
      // If it's an ORCS card, try to find and delete the original file
      if (fileToDelete.type === 'orcs_card') {
        const originalName = fileToDelete.name.replace('_ORCS_CARD.txt', '');
        const rawFiles = await fs.readdir(RAW_DIR);
        
        for (const rawFile of rawFiles) {
          if (path.parse(rawFile).name === originalName) {
            const rawPath = path.join(RAW_DIR, rawFile);
            try {
              await fs.unlink(rawPath);
            } catch (error) {
              // Original file might not exist, continue anyway
            }
            break;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9.-]/gi, '_');
  }
}

export const fileService = new FileService();
