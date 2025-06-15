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
    const fileData: File = {
      id: uuidv4(),
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
        
        files.push({
          id: uuidv4(),
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
        
        files.push({
          id: uuidv4(),
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

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9.-]/gi, '_');
  }
}

export const fileService = new FileService();
