import { File, InsertFile, Tag, InsertTag, OrcsCard, InsertOrcsCard } from "@shared/schema";

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
}

// Memory-based implementation that simulates file operations
// In production, this would interact directly with the filesystem
export class MemStorage implements IStorage {
  private files: Map<string, File> = new Map();
  private orcsCards: Map<string, OrcsCard> = new Map();
  private tags: Map<string, Tag> = new Map();
  
  constructor() {
    this.ensureDirectories();
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
}

export const storage = new MemStorage();
