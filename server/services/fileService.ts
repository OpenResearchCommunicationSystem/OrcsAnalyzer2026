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
    const metadataFilename = `${baseName}.yaml.txt`;
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
    const metadataFilename = `${baseName}.yaml.txt`;
    const metadataPath = path.join(RAW_DIR, metadataFilename);
    
    try {
      return await fs.readFile(metadataPath, 'utf-8');
    } catch (error) {
      return null; // Metadata file doesn't exist
    }
  }

  async updateMetadataFile(filename: string, content: string): Promise<void> {
    const baseName = path.parse(filename).name;
    const metadataFilename = `${baseName}.yaml.txt`;
    const metadataPath = path.join(RAW_DIR, metadataFilename);
    
    await fs.writeFile(metadataPath, content, 'utf-8');
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
      
      // Process only raw files, filter out metadata files
      for (const filename of rawFiles) {
        if (filename === '.gitkeep') continue;
        if (filename.endsWith('.yaml.txt')) continue; // Skip metadata files
        
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
