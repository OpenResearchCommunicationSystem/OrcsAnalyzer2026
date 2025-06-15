import { File, InsertFile, Tag, InsertTag, OrcsCard, InsertOrcsCard } from "@shared/schema";
import { promises as fs } from 'fs';
import path from 'path';

// File-based storage interface for ORCS system
export interface IStorage {
  // File operations
  getFiles(): Promise<File[]>;
  getFile(id: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  deleteFile(id: string): Promise<boolean>;
  
  // ORCS Card operations
  getOrcsCards(): Promise<OrcsCard[]>;
  getOrcsCard(id: string): Promise<OrcsCard | undefined>;
  createOrcsCard(card: InsertOrcsCard): Promise<OrcsCard>;
  updateOrcsCard(id: string, updates: Partial<OrcsCard>): Promise<OrcsCard>;
  deleteOrcsCard(id: string): Promise<boolean>;
  
  // Tag operations
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  getTagsByType(type: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, updates: Partial<Tag>): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
  
  // Content operations
  getFileContent(path: string): Promise<string>;
  writeFileContent(path: string, content: string): Promise<void>;
  
  // Directory operations
  ensureDirectories(): Promise<void>;
  getDirectoryStats(): Promise<{ totalFiles: number; totalTags: number; tagCounts: Record<string, number> }>;
  
  // Index operations
  buildIndex(): Promise<void>;
  saveIndex(): Promise<void>;
  loadIndex(): Promise<void>;
  searchFiles(query: string): Promise<File[]>;
  searchContent(query: string): Promise<{ file: File; matches: string[] }[]>;
}

// Memory-based implementation that simulates file operations
// In production, this would interact directly with the filesystem
interface SearchIndex {
  files: Map<string, { keywords: string[]; content: string; lastModified: string }>;
  tags: Map<string, { keywords: string[]; lastModified: string }>;
  lastUpdated: string;
}

export class MemStorage implements IStorage {
  private files: Map<string, File> = new Map();
  private orcsCards: Map<string, OrcsCard> = new Map();
  private tags: Map<string, Tag> = new Map();
  private searchIndex: SearchIndex = {
    files: new Map(),
    tags: new Map(),
    lastUpdated: new Date().toISOString()
  };
  
  private readonly INDEX_FILE = path.join(process.cwd(), 'user_data', 'index.json');

  constructor() {
    this.ensureDirectories().then(() => {
      this.loadIndex().then(() => {
        // Delay initial indexing to allow file service to populate data
        setTimeout(() => this.buildIndex(), 1000);
      });
    });
  }

  async ensureDirectories(): Promise<void> {
    // In a real implementation, this would create the directory structure
    console.log('Ensuring user_data directories exist');
  }

  async getFiles(): Promise<File[]> {
    return Array.from(this.files.values());
  }

  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const file: File = {
      ...insertFile,
      id,
    };
    this.files.set(id, file);
    return file;
  }

  async deleteFile(id: string): Promise<boolean> {
    return this.files.delete(id);
  }

  async getOrcsCards(): Promise<OrcsCard[]> {
    return Array.from(this.orcsCards.values());
  }

  async getOrcsCard(id: string): Promise<OrcsCard | undefined> {
    return this.orcsCards.get(id);
  }

  async createOrcsCard(insertCard: InsertOrcsCard): Promise<OrcsCard> {
    const id = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const card: OrcsCard = {
      ...insertCard,
      id,
      created: now,
      modified: now,
    };
    this.orcsCards.set(id, card);
    return card;
  }

  async updateOrcsCard(id: string, updates: Partial<OrcsCard>): Promise<OrcsCard> {
    const existing = this.orcsCards.get(id);
    if (!existing) {
      throw new Error(`ORCS Card not found: ${id}`);
    }
    const updated = {
      ...existing,
      ...updates,
      modified: new Date().toISOString(),
    };
    this.orcsCards.set(id, updated);
    return updated;
  }

  async deleteOrcsCard(id: string): Promise<boolean> {
    return this.orcsCards.delete(id);
  }

  async getTags(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }

  async getTag(id: string): Promise<Tag | undefined> {
    return this.tags.get(id);
  }

  async getTagsByType(type: string): Promise<Tag[]> {
    return Array.from(this.tags.values()).filter(tag => tag.type === type);
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const id = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const tag: Tag = {
      ...insertTag,
      id,
      created: now,
      modified: now,
    };
    this.tags.set(id, tag);
    return tag;
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    const existing = this.tags.get(id);
    if (!existing) {
      throw new Error(`Tag not found: ${id}`);
    }
    const updated = {
      ...existing,
      ...updates,
      modified: new Date().toISOString(),
    };
    this.tags.set(id, updated);
    return updated;
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.tags.delete(id);
  }

  async getFileContent(path: string): Promise<string> {
    // In a real implementation, this would read from filesystem
    // For now, return empty or throw error
    throw new Error(`File not found: ${path}`);
  }

  async writeFileContent(path: string, content: string): Promise<void> {
    // In a real implementation, this would write to filesystem
    console.log(`Writing to ${path}:`, content.substring(0, 100) + '...');
  }

  async getDirectoryStats(): Promise<{ totalFiles: number; totalTags: number; tagCounts: Record<string, number> }> {
    const tags = Array.from(this.tags.values());
    const tagCounts = tags.reduce((acc, tag) => {
      acc[tag.type] = (acc[tag.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFiles: this.files.size,
      totalTags: this.tags.size,
      tagCounts,
    };
  }

  // Index operations
  async buildIndex(): Promise<void> {
    console.log('Building search index...');
    
    // Index files
    for (const [id, file] of this.files) {
      try {
        const content = await this.getFileContent(file.path);
        const keywords = this.extractKeywords(content + ' ' + file.name);
        
        this.searchIndex.files.set(id, {
          keywords,
          content,
          lastModified: file.modified
        });
      } catch (error) {
        console.warn(`Failed to index file ${file.name}:`, error);
      }
    }

    // Index ORCS cards
    for (const [id, card] of this.orcsCards) {
      try {
        const content = await this.getFileContent(card.source.replace('file:///', ''));
        const keywords = this.extractKeywords(content + ' ' + card.title + ' ' + card.citation);
        
        this.searchIndex.files.set(id, {
          keywords,
          content,
          lastModified: card.modified
        });
      } catch (error) {
        console.warn(`Failed to index ORCS card ${card.title}:`, error);
      }
    }

    // Index tags
    for (const [id, tag] of this.tags) {
      const keywords = this.extractKeywords(
        tag.name + ' ' + 
        tag.aliases.join(' ') + ' ' + 
        tag.description + ' ' + 
        Object.values(tag.keyValuePairs).join(' ')
      );
      
      this.searchIndex.tags.set(id, {
        keywords,
        lastModified: tag.modified
      });
    }

    this.searchIndex.lastUpdated = new Date().toISOString();
    await this.saveIndex();
    console.log(`Index built: ${this.searchIndex.files.size} files, ${this.searchIndex.tags.size} tags`);
  }

  async saveIndex(): Promise<void> {
    try {
      const indexData = {
        files: Array.from(this.searchIndex.files.entries()),
        tags: Array.from(this.searchIndex.tags.entries()),
        lastUpdated: this.searchIndex.lastUpdated
      };
      
      await fs.writeFile(this.INDEX_FILE, JSON.stringify(indexData, null, 2));
      console.log('Search index saved to', this.INDEX_FILE);
    } catch (error) {
      console.warn('Failed to save search index:', error);
    }
  }

  async loadIndex(): Promise<void> {
    try {
      const indexData = JSON.parse(await fs.readFile(this.INDEX_FILE, 'utf-8'));
      
      this.searchIndex.files = new Map(indexData.files);
      this.searchIndex.tags = new Map(indexData.tags);
      this.searchIndex.lastUpdated = indexData.lastUpdated;
      
      console.log(`Search index loaded: ${this.searchIndex.files.size} files, ${this.searchIndex.tags.size} tags`);
    } catch (error) {
      console.log('No existing search index found, will build new one');
      this.searchIndex = {
        files: new Map(),
        tags: new Map(),
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async searchFiles(query: string): Promise<File[]> {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (searchTerms.length === 0) return Array.from(this.files.values());

    const results: { file: File; score: number }[] = [];

    for (const [id, file] of this.files) {
      const indexed = this.searchIndex.files.get(id);
      if (!indexed) continue;

      let score = 0;
      for (const term of searchTerms) {
        // Search in filename (higher weight)
        if (file.name.toLowerCase().includes(term)) score += 10;
        
        // Search in keywords
        const matchingKeywords = indexed.keywords.filter(keyword => 
          keyword.toLowerCase().includes(term)
        );
        score += matchingKeywords.length * 2;

        // Search in content
        if (indexed.content.toLowerCase().includes(term)) score += 1;
      }

      if (score > 0) {
        results.push({ file, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(result => result.file);
  }

  async searchContent(query: string): Promise<{ file: File; matches: string[] }[]> {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (searchTerms.length === 0) return [];

    const results: { file: File; matches: string[] }[] = [];

    for (const [id, file] of this.files) {
      const indexed = this.searchIndex.files.get(id);
      if (!indexed) continue;

      const matches: string[] = [];
      const content = indexed.content.toLowerCase();

      for (const term of searchTerms) {
        const regex = new RegExp(`.{0,30}${term}.{0,30}`, 'gi');
        const termMatches = content.match(regex);
        if (termMatches) {
          matches.push(...termMatches.map(match => match.trim()));
        }
      }

      if (matches.length > 0) {
        results.push({ file, matches: [...new Set(matches)] });
      }
    }

    return results;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
      .slice(0, 100); // Limit keywords per document
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has',
      'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
      'can', 'shall', 'it', 'its', 'he', 'she', 'his', 'her', 'him', 'them', 'they', 'their'
    ]);
    return stopWords.has(word);
  }
}

export const storage = new MemStorage();
