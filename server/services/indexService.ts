import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { 
  MasterIndex, 
  IndexedFile, 
  IndexedTag, 
  IndexedConnection, 
  BrokenConnection,
  TagType 
} from '@shared/schema';

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');
const INDEX_FILE = path.join(USER_DATA_DIR, 'index.json');
const INDEX_VERSION = '2025.001';

const TAG_DIRECTORIES = {
  entity: path.join(USER_DATA_DIR, 'entities'),
  relationship: path.join(USER_DATA_DIR, 'relationships'),
  attribute: path.join(USER_DATA_DIR, 'attributes'),
  comment: path.join(USER_DATA_DIR, 'comments'),
  kv_pair: path.join(USER_DATA_DIR, 'kv_pairs'),
};

const RAW_DIR = path.join(USER_DATA_DIR, 'raw');

export class IndexService {
  private index: MasterIndex | null = null;
  private isIndexing = false;
  private fileHashes: Map<string, string> = new Map();

  private createEmptyIndex(): MasterIndex {
    return {
      version: INDEX_VERSION,
      lastUpdated: new Date().toISOString(),
      files: [],
      tags: [],
      connections: [],
      brokenConnections: [],
      stats: {
        totalFiles: 0,
        totalTags: 0,
        totalConnections: 0,
        brokenConnectionCount: 0,
        entityCount: 0,
        relationshipCount: 0,
      },
    };
  }

  async loadIndex(): Promise<MasterIndex> {
    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.version === INDEX_VERSION) {
        this.index = parsed;
        this.rebuildHashMap();
        return this.index!;
      }
    } catch (error) {
    }
    return this.buildFullIndex();
  }

  async getIndex(): Promise<MasterIndex> {
    if (this.index) {
      return this.index;
    }
    return this.loadIndex();
  }

  private rebuildHashMap(): void {
    this.fileHashes.clear();
    if (this.index) {
      for (const file of this.index.files) {
        this.fileHashes.set(file.path, file.hash);
      }
    }
  }

  async buildFullIndex(): Promise<MasterIndex> {
    if (this.isIndexing) {
      while (this.isIndexing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.index!;
    }

    this.isIndexing = true;
    console.log('[IndexService] Starting full index build...');

    try {
      const newIndex = this.createEmptyIndex();
      
      const files = await this.indexAllFiles();
      newIndex.files = files;
      
      const tags = await this.indexAllTags();
      newIndex.tags = tags;
      
      const { connections, brokenConnections } = await this.indexConnections(tags);
      newIndex.connections = connections;
      newIndex.brokenConnections = brokenConnections;
      
      newIndex.stats = {
        totalFiles: files.length,
        totalTags: tags.length,
        totalConnections: connections.length,
        brokenConnectionCount: brokenConnections.length,
        entityCount: tags.filter(t => t.type === 'entity').length,
        relationshipCount: tags.filter(t => t.type === 'relationship').length,
      };
      
      newIndex.lastUpdated = new Date().toISOString();
      
      await this.saveIndex(newIndex);
      this.index = newIndex;
      this.rebuildHashMap();
      
      console.log(`[IndexService] Index built: ${files.length} files, ${tags.length} tags, ${connections.length} connections, ${brokenConnections.length} broken`);
      
      return newIndex;
    } finally {
      this.isIndexing = false;
    }
  }

  private async indexAllFiles(): Promise<IndexedFile[]> {
    const files: IndexedFile[] = [];
    
    try {
      const rawFiles = await fs.readdir(RAW_DIR);
      
      for (const filename of rawFiles) {
        if (filename === '.gitkeep') continue;
        
        const filepath = path.join(RAW_DIR, filename);
        const stats = await fs.stat(filepath);
        
        if (!stats.isFile()) continue;
        
        const content = await fs.readFile(filepath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        const isCard = filename.endsWith('.card.txt');
        let cardUuid: string | undefined;
        let sourceFile: string | undefined;
        
        if (isCard) {
          const uuidMatch = content.match(/uuid:\s*"([^"]+)"/);
          const sourceMatch = content.match(/source_file:\s*"([^"]+)"/);
          cardUuid = uuidMatch?.[1];
          sourceFile = sourceMatch?.[1];
        }
        
        files.push({
          id: crypto.createHash('md5').update(filepath).digest('hex'),
          path: filepath,
          name: filename,
          type: this.getFileType(filename),
          hash,
          timestamp: stats.mtimeMs,
          cardUuid,
          sourceFile,
        });
      }
    } catch (error) {
    }
    
    return files;
  }

  private getFileType(filename: string): string {
    if (filename.endsWith('.card.txt')) return 'orcs_card';
    if (filename.endsWith('.entity.txt')) return 'entity';
    if (filename.endsWith('.relate.txt')) return 'relationship';
    if (filename.endsWith('.attrib.txt')) return 'attribute';
    if (filename.endsWith('.comment.txt')) return 'comment';
    if (filename.endsWith('.kv.txt')) return 'kv_pair';
    if (filename.endsWith('.csv')) return 'csv';
    return 'txt';
  }

  private async indexAllTags(): Promise<IndexedTag[]> {
    const tags: IndexedTag[] = [];
    
    for (const [type, dir] of Object.entries(TAG_DIRECTORIES)) {
      try {
        const files = await fs.readdir(dir);
        
        for (const filename of files) {
          if (filename === '.gitkeep') continue;
          
          const filepath = path.join(dir, filename);
          const content = await fs.readFile(filepath, 'utf-8');
          
          const tag = this.parseTagFromContent(content, type as TagType, filepath);
          if (tag) {
            tags.push(tag);
          }
        }
      } catch (error) {
      }
    }
    
    return tags;
  }

  private parseTagFromContent(content: string, expectedType: TagType, filepath: string): IndexedTag | null {
    try {
      const idMatch = content.match(/id:\s*"([^"]+)"/);
      const nameMatch = content.match(/name:\s*"([^"]+)"/);
      const typeMatch = content.match(/type:\s*"([^"]+)"/);
      
      if (!idMatch || !nameMatch) return null;
      
      const referencesMatch = content.match(/references:\s*\[([\s\S]*?)\]/);
      const references: string[] = [];
      if (referencesMatch) {
        const refMatches = Array.from(referencesMatch[1].matchAll(/"([^"]+)"/g));
        for (const match of refMatches) {
          references.push(match[1]);
        }
      }
      
      const aliasesMatch = content.match(/aliases:\s*\[([\s\S]*?)\]/);
      const aliases: string[] = [];
      if (aliasesMatch) {
        const aliasMatches = Array.from(aliasesMatch[1].matchAll(/"([^"]+)"/g));
        for (const match of aliasMatches) {
          aliases.push(match[1]);
        }
      }
      
      return {
        id: idMatch[1],
        name: nameMatch[1],
        type: (typeMatch?.[1] as TagType) || expectedType,
        filePath: filepath,
        references,
        aliases,
      };
    } catch (error) {
      return null;
    }
  }

  private async indexConnections(tags: IndexedTag[]): Promise<{
    connections: IndexedConnection[];
    brokenConnections: BrokenConnection[];
  }> {
    const connections: IndexedConnection[] = [];
    const brokenConnections: BrokenConnection[] = [];
    
    const entityTagIds = new Set(tags.filter(t => t.type === 'entity').map(t => t.id));
    const relationshipTagIds = new Set(tags.filter(t => t.type === 'relationship').map(t => t.id));
    
    const relationshipDir = TAG_DIRECTORIES.relationship;
    
    try {
      const files = await fs.readdir(relationshipDir);
      
      for (const filename of files) {
        if (filename === '.gitkeep') continue;
        
        const filepath = path.join(relationshipDir, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        
        const connectedEntitiesMatch = content.match(/connectedEntities:\s*\[([\s\S]*?)\]/);
        if (!connectedEntitiesMatch) continue;
        
        const idMatch = content.match(/id:\s*"([^"]+)"/);
        if (!idMatch) continue;
        
        const relationshipId = idMatch[1];
        
        const entityMatches = Array.from(connectedEntitiesMatch[1].matchAll(/id:\s*"([^"]+)"[\s\S]*?direction:\s*(\d)/g));
        const connectedEntities: Array<{id: string, direction: number}> = [];
        
        for (const match of entityMatches) {
          connectedEntities.push({
            id: match[1],
            direction: parseInt(match[2], 10),
          });
        }
        
        for (let i = 0; i < connectedEntities.length - 1; i++) {
          for (let j = i + 1; j < connectedEntities.length; j++) {
            const sourceEntity = connectedEntities[i];
            const targetEntity = connectedEntities[j];
            
            const connectionId = `${sourceEntity.id}-${relationshipId}-${targetEntity.id}`;
            
            if (!entityTagIds.has(sourceEntity.id)) {
              brokenConnections.push({
                connectionId,
                reason: 'missing_source',
                details: `Source entity ${sourceEntity.id} not found`,
                filePath: filepath,
              });
              continue;
            }
            
            if (!entityTagIds.has(targetEntity.id)) {
              brokenConnections.push({
                connectionId,
                reason: 'missing_target',
                details: `Target entity ${targetEntity.id} not found`,
                filePath: filepath,
              });
              continue;
            }
            
            connections.push({
              id: connectionId,
              sourceEntityId: sourceEntity.id,
              targetEntityId: targetEntity.id,
              relationshipId,
              direction: Math.max(sourceEntity.direction, targetEntity.direction) as 0 | 1 | 2 | 3,
              filePath: filepath,
            });
          }
        }
      }
    } catch (error) {
    }
    
    return { connections, brokenConnections };
  }

  async saveIndex(index: MasterIndex): Promise<void> {
    try {
      await fs.mkdir(USER_DATA_DIR, { recursive: true });
      await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('[IndexService] Failed to save index:', error);
    }
  }

  async checkFileChanged(filepath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const newHash = crypto.createHash('sha256').update(content).digest('hex');
      const oldHash = this.fileHashes.get(filepath);
      return newHash !== oldHash;
    } catch (error) {
      return true;
    }
  }

  async reindexFile(filepath: string): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }
    
    const filename = path.basename(filepath);
    const content = await fs.readFile(filepath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const stats = await fs.stat(filepath);
    
    this.index!.files = this.index!.files.filter(f => f.path !== filepath);
    
    const isCard = filename.endsWith('.card.txt');
    let cardUuid: string | undefined;
    let sourceFile: string | undefined;
    
    if (isCard) {
      const uuidMatch = content.match(/uuid:\s*"([^"]+)"/);
      const sourceMatch = content.match(/source_file:\s*"([^"]+)"/);
      cardUuid = uuidMatch?.[1];
      sourceFile = sourceMatch?.[1];
    }
    
    this.index!.files.push({
      id: crypto.createHash('md5').update(filepath).digest('hex'),
      path: filepath,
      name: filename,
      type: this.getFileType(filename),
      hash,
      timestamp: stats.mtimeMs,
      cardUuid,
      sourceFile,
    });
    
    this.fileHashes.set(filepath, hash);
    this.index!.lastUpdated = new Date().toISOString();
    
    await this.saveIndex(this.index!);
  }

  async removeFromIndex(filepath: string): Promise<void> {
    if (!this.index) return;
    
    this.index.files = this.index.files.filter(f => f.path !== filepath);
    this.index.tags = this.index.tags.filter(t => t.filePath !== filepath);
    this.fileHashes.delete(filepath);
    
    await this.saveIndex(this.index);
  }

  async reindexTag(tagId: string, tagFilePath: string): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }
    
    try {
      const content = await fs.readFile(tagFilePath, 'utf-8');
      const tagType = this.getTagTypeFromPath(tagFilePath);
      const parsedTag = this.parseTagFromContent(content, tagType, tagFilePath);
      
      if (parsedTag) {
        // Remove old entry and add new one
        this.index!.tags = this.index!.tags.filter(t => t.id !== tagId);
        this.index!.tags.push(parsedTag);
        
        // Update stats
        this.index!.stats.totalTags = this.index!.tags.length;
        this.index!.stats.entityCount = this.index!.tags.filter(t => t.type === 'entity').length;
        this.index!.stats.relationshipCount = this.index!.tags.filter(t => t.type === 'relationship').length;
        
        // Rebuild connections if this is an entity or relationship tag
        if (parsedTag.type === 'entity' || parsedTag.type === 'relationship') {
          await this.rebuildConnections();
        }
        
        this.index!.lastUpdated = new Date().toISOString();
        
        await this.saveIndex(this.index!);
      }
    } catch (error) {
      console.error('[IndexService] Failed to reindex tag:', error);
    }
  }

  async removeTagFromIndex(tagId: string): Promise<void> {
    if (!this.index) return;
    
    const removedTag = this.index.tags.find(t => t.id === tagId);
    this.index.tags = this.index.tags.filter(t => t.id !== tagId);
    
    // Remove connections involving this tag
    this.index.connections = this.index.connections.filter(
      c => c.sourceEntityId !== tagId && c.targetEntityId !== tagId && c.relationshipId !== tagId
    );
    this.index.brokenConnections = this.index.brokenConnections.filter(
      bc => !bc.connectionId.includes(tagId)
    );
    
    // Rebuild connections if this was an entity or relationship tag
    if (removedTag && (removedTag.type === 'entity' || removedTag.type === 'relationship')) {
      await this.rebuildConnections();
    }
    
    // Update stats
    this.index.stats.totalTags = this.index.tags.length;
    this.index.stats.totalConnections = this.index.connections.length;
    this.index.stats.brokenConnectionCount = this.index.brokenConnections.length;
    this.index.stats.entityCount = this.index.tags.filter(t => t.type === 'entity').length;
    this.index.stats.relationshipCount = this.index.tags.filter(t => t.type === 'relationship').length;
    this.index.lastUpdated = new Date().toISOString();
    
    await this.saveIndex(this.index);
  }

  private async rebuildConnections(): Promise<void> {
    if (!this.index) return;
    
    const { connections, brokenConnections } = await this.indexConnections(
      this.index.tags.map(t => ({
        ...t,
        type: t.type as TagType,
      }))
    );
    
    this.index.connections = connections;
    this.index.brokenConnections = brokenConnections;
    this.index.stats.totalConnections = connections.length;
    this.index.stats.brokenConnectionCount = brokenConnections.length;
  }

  private getTagTypeFromPath(filepath: string): TagType {
    if (filepath.includes('/entities/')) return 'entity';
    if (filepath.includes('/relationships/')) return 'relationship';
    if (filepath.includes('/attributes/')) return 'attribute';
    if (filepath.includes('/comments/')) return 'comment';
    if (filepath.includes('/kv_pairs/')) return 'kv_pair';
    return 'entity';
  }

  async validateConnections(): Promise<BrokenConnection[]> {
    if (!this.index) {
      await this.loadIndex();
    }
    
    const tags = this.index!.tags;
    const { brokenConnections } = await this.indexConnections(
      tags.map(t => ({
        ...t,
        type: t.type as TagType,
      }))
    );
    
    this.index!.brokenConnections = brokenConnections;
    this.index!.stats.brokenConnectionCount = brokenConnections.length;
    
    await this.saveIndex(this.index!);
    
    return brokenConnections;
  }

  getTagById(tagId: string): IndexedTag | undefined {
    return this.index?.tags.find(t => t.id === tagId);
  }

  getFileByPath(filepath: string): IndexedFile | undefined {
    return this.index?.files.find(f => f.path === filepath);
  }

  getConnectionsForEntity(entityId: string): IndexedConnection[] {
    return this.index?.connections.filter(
      c => c.sourceEntityId === entityId || c.targetEntityId === entityId
    ) || [];
  }
}

export const indexService = new IndexService();
