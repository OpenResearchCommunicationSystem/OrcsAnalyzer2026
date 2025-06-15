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

    // Create corresponding ORCS card
    await this.createOrcsCard(fileData, content.toString('utf-8'));
    
    return fileData;
  }

  async createOrcsCard(file: File, content: string): Promise<OrcsCard> {
    const cardId = uuidv4();
    const now = new Date().toISOString();
    const sourceHash = crypto.createHash('sha256').update(content).digest('hex');
    
    const cardData: OrcsCard = {
      id: cardId,
      title: `${file.name} - ORCS Analysis Card`,
      source: `file:///${file.path}`,
      sourceHash: `sha256:${sourceHash}`,
      citation: `Original file: ${file.name}`,
      classification: 'Proprietary Information',
      handling: ['Copyright 2025 TechWatch Intelligence', 'Distribution: Internal Use Only'],
      created: now,
      modified: now,
      content: content,
      keyValuePairs: {
        original_filename: file.name,
        file_type: file.type,
        orcs_version: '2025.003'
      },
      tags: [],
    };

    const cardFilename = `${path.parse(file.name).name}_ORCS_CARD.txt`;
    const cardPath = path.join(CARDS_DIR, cardFilename);
    
    const orcsContent = this.formatOrcsCard(cardData);
    await fs.writeFile(cardPath, orcsContent, 'utf-8');
    
    return cardData;
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
      const cardFiles = await fs.readdir(CARDS_DIR);
      
      const files: File[] = [];
      
      // Process raw files
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
          type: filename.endsWith('.csv') ? 'csv' : 'txt',
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        });
      }
      
      // Process card files
      for (const filename of cardFiles) {
        if (filename === '.gitkeep') continue;
        const filepath = path.join(CARDS_DIR, filename);
        const stats = await fs.stat(filepath);
        
        // Use a consistent ID based on file path and modified time
        const id = crypto.createHash('md5').update(`${filepath}-${stats.mtime.getTime()}`).digest('hex');
        
        files.push({
          id,
          name: filename,
          path: filepath,
          type: 'orcs_card',
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
