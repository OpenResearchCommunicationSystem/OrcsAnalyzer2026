import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Tag, InsertTag, TagType, GraphData, GraphNode, GraphEdge, Link, InsertLink, Snippet, InsertSnippet, Entity, Bullet } from '@shared/schema';
import { storage } from '../storage';

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');

const TAG_DIRECTORIES: Record<string, string> = {
  entity: path.join(USER_DATA_DIR, 'entities'),
  relationship: path.join(USER_DATA_DIR, 'relationships'),
  attribute: path.join(USER_DATA_DIR, 'attributes'),
  comment: path.join(USER_DATA_DIR, 'comments'),
  label: path.join(USER_DATA_DIR, 'labels'),
  data: path.join(USER_DATA_DIR, 'data'),
};

export class OrcsService {
  async createTag(insertTag: InsertTag): Promise<Tag> {
    const tagId = uuidv4();
    const now = new Date().toISOString();
    
    const tag: Tag = {
      ...insertTag,
      id: tagId,
      created: now,
      modified: now,
    };

    await this.saveTagToFile(tag);
    
    // Update card content with new tag markup
    await this.updateCardContent(tag);
    
    return tag;
  }

  async updateTag(tagId: string, updates: Partial<Tag>): Promise<Tag> {
    const existingTag = await this.getTag(tagId);
    if (!existingTag) {
      throw new Error(`Tag not found: ${tagId}`);
    }

    const updatedTag: Tag = {
      ...existingTag,
      ...updates,
      id: tagId, // Ensure ID doesn't change
      modified: new Date().toISOString(),
    };

    await this.saveTagToFile(updatedTag);
    
    // Update card content with tag markup
    await this.updateCardContent(updatedTag);
    
    return updatedTag;
  }

  async getTag(tagId: string): Promise<Tag | undefined> {
    // Search across all tag directories
    for (const [type, dir] of Object.entries(TAG_DIRECTORIES)) {
      try {
        const files = await fs.readdir(dir);
        for (const filename of files) {
          if (filename === '.gitkeep') continue;
          const filepath = path.join(dir, filename);
          const content = await fs.readFile(filepath, 'utf-8');
          const tag = this.parseTagFromOrcsFile(content);
          if (tag && tag.id === tagId) {
            return tag;
          }
        }
      } catch (error) {
        // Directory might not exist or be empty
      }
    }
    return undefined;
  }

  async getTags(): Promise<Tag[]> {
    const tags: Tag[] = [];
    const processedFiles = new Set<string>(); // Avoid processing same file twice
    
    // Wikipedia approach: Search ALL directories for tag files, regardless of location
    for (const dir of Object.values(TAG_DIRECTORIES)) {
      try {
        const files = await fs.readdir(dir);
        for (const filename of files) {
          if (filename === '.gitkeep') continue;
          
          const filepath = path.join(dir, filename);
          
          // Skip if we've already processed this file (avoid duplicates)
          if (processedFiles.has(filepath)) continue;
          processedFiles.add(filepath);
          
          // Check if it's any type of tag file (regardless of directory)
          const isAnyTagFile = this.isAnyTagFile(filename);
          if (!isAnyTagFile) continue;
          
          const content = await fs.readFile(filepath, 'utf-8');
          const tag = this.parseTagFromOrcsFile(content);
          if (tag) {
            tags.push(tag);
            
            // Auto-migrate legacy .orcs files to new extensions
            if (filename.endsWith('.orcs')) {
              await this.migrateTagFile(tag, filepath);
            }
          }
        }
      } catch (error) {
        // Directory might not exist or be empty
      }
    }
    
    return tags;
  }

  private isAnyTagFile(filename: string): boolean {
    // Check if file matches any tag type extension
    const allExtensions = [
      'entity.txt', 'relate.txt', 'attrib.txt', 'comment.txt', 'label.txt', 'data.txt', 'orcs'
    ];
    
    return allExtensions.some(ext => filename.endsWith('.' + ext));
  }

  private isValidTagFile(filename: string, tagType: TagType): boolean {
    // Support new double extensions
    const newExtension = this.getFileExtension(tagType);
    if (filename.endsWith('.' + newExtension)) {
      return true;
    }
    
    // Support legacy .orcs files
    if (filename.endsWith('.orcs')) {
      return true;
    }
    
    return false;
  }

  private async migrateTagFile(tag: Tag, oldFilepath: string): Promise<void> {
    try {
      // Check if new file already exists to avoid duplicate migration
      const newExtension = this.getFileExtension(tag.type);
      const newFilename = `${tag.name}_${tag.id}.${newExtension}`;
      const newFilepath = path.join(path.dirname(oldFilepath), newFilename);
      
      try {
        await fs.access(newFilepath);
        // New file exists, just remove old one silently
        await fs.unlink(oldFilepath);
        return;
      } catch {
        // New file doesn't exist, proceed with migration
      }
      
      // Save with new extension
      await this.saveTagToFile(tag);
      
      // Remove old .orcs file
      await fs.unlink(oldFilepath);
      
      console.log(`Migrated tag file: ${path.basename(oldFilepath)} -> ${newFilename}`);
    } catch (error: any) {
      // Only log error if it's not a "file not found" error (migration already completed)
      if (error?.code !== 'ENOENT') {
        console.error(`Failed to migrate tag file ${oldFilepath}:`, error);
      }
    }
  }

  async getTagsByType(type: TagType): Promise<Tag[]> {
    const tags: Tag[] = [];
    const dir = TAG_DIRECTORIES[type];
    
    try {
      const files = await fs.readdir(dir);
      for (const filename of files) {
        if (filename === '.gitkeep') continue;
        
        const isValidTagFile = this.isValidTagFile(filename, type);
        if (!isValidTagFile) continue;
        
        const filepath = path.join(dir, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        const tag = this.parseTagFromOrcsFile(content);
        if (tag) {
          tags.push(tag);
          
          // Auto-migrate legacy .orcs files
          if (filename.endsWith('.orcs')) {
            await this.migrateTagFile(tag, filepath);
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be empty
    }
    
    return tags;
  }

  async previewTagDeletion(tagId: string): Promise<{
    tag: Tag | null;
    affectedCards: string[];
    affectedLinks: number;
    affectedConnections: number;
    tagFilePath: string | null;
  }> {
    const tag = await this.getTag(tagId);
    if (!tag) {
      return { tag: null, affectedCards: [], affectedLinks: 0, affectedConnections: 0, tagFilePath: null };
    }

    // Find affected cards
    const affectedCards = (tag.references || []).filter(ref => ref.includes('.card.txt'));
    
    // Count affected links in cards
    let affectedLinks = 0;
    for (const cardFilename of affectedCards) {
      try {
        const cardPath = path.join(process.cwd(), 'user_data', 'raw', cardFilename);
        const cardContent = await fs.readFile(cardPath, 'utf-8');
        // Count links that reference this tag
        const linkMatches = cardContent.match(new RegExp(`sourceId:\\s*"?${tagId}"?|targetId:\\s*"?${tagId}"?`, 'g'));
        affectedLinks += linkMatches ? linkMatches.length : 0;
      } catch {
        // Card might not exist
      }
    }

    // Count affected connections
    const connections = await storage.getTagConnections();
    const affectedConnections = connections.filter(c => 
      c.sourceTagId === tagId || 
      c.targetTagId === tagId || 
      c.relationshipTagId === tagId ||
      c.attributeTagIds.includes(tagId)
    ).length;

    const tagFilePath = await this.findTagFile(tag);

    return { tag, affectedCards, affectedLinks, affectedConnections, tagFilePath };
  }

  async deleteTag(tagId: string): Promise<boolean> {
    const tag = await this.getTag(tagId);
    if (!tag) {
      return false;
    }

    // Remove tag from all card content before deleting the tag file
    await this.removeTagFromCards(tag);

    // Also remove any links that reference this tag from cards
    await this.removeLinksReferencingTag(tagId);

    // Delete connections that reference this tag
    await this.deleteConnectionsReferencingTag(tagId);

    // Try to find and delete the tag file using Wikipedia approach - search everywhere
    const filepath = await this.findTagFile(tag);
    if (!filepath) {
      console.error(`Tag file not found for tag: ${tagId}`);
      return false;
    }
    
    try {
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      console.error(`Failed to delete tag file: ${filepath}`, error);
      return false;
    }
  }

  private async removeLinksReferencingTag(tagId: string): Promise<void> {
    // Find all cards and remove links that reference this tag
    const rawDir = path.join(USER_DATA_DIR, 'raw');
    try {
      const files = await fs.readdir(rawDir);
      for (const file of files) {
        if (!file.endsWith('.card.txt')) continue;
        
        const cardPath = path.join(rawDir, file);
        const content = await fs.readFile(cardPath, 'utf-8');
        
        // Check if card has LINK INDEX
        if (!content.includes('=== LINK INDEX START ===')) continue;
        
        // Parse and filter links
        const linkIndexMatch = content.match(/=== LINK INDEX START ===([\s\S]*?)=== LINK INDEX END ===/);
        if (!linkIndexMatch) continue;
        
        const linkSection = linkIndexMatch[1];
        const lines = linkSection.split('\n');
        const filteredLines: string[] = [];
        
        for (const line of lines) {
          // Skip links that reference the deleted tag
          if (line.includes(`sourceId:"${tagId}"`) || line.includes(`sourceId: "${tagId}"`) ||
              line.includes(`targetId:"${tagId}"`) || line.includes(`targetId: "${tagId}"`)) {
            console.log(`Removing link referencing deleted tag ${tagId} from ${file}`);
            continue;
          }
          filteredLines.push(line);
        }
        
        // Only update if we removed something
        if (filteredLines.length !== lines.length) {
          const newLinkSection = filteredLines.join('\n');
          const updatedContent = content.replace(
            /=== LINK INDEX START ===([\s\S]*?)=== LINK INDEX END ===/,
            `=== LINK INDEX START ===${newLinkSection}=== LINK INDEX END ===`
          );
          await fs.writeFile(cardPath, updatedContent, 'utf-8');
        }
      }
    } catch (error) {
      console.error('Error removing links referencing tag:', error);
    }
  }

  private async deleteConnectionsReferencingTag(tagId: string): Promise<void> {
    const connections = await storage.getTagConnections();
    for (const connection of connections) {
      if (connection.sourceTagId === tagId || 
          connection.targetTagId === tagId || 
          connection.relationshipTagId === tagId) {
        await storage.deleteTagConnection(connection.id);
        console.log(`Deleted connection ${connection.id} referencing deleted tag ${tagId}`);
      } else if (connection.attributeTagIds.includes(tagId)) {
        // Remove tag from attribute list
        const updatedAttributeIds = connection.attributeTagIds.filter(id => id !== tagId);
        await storage.updateTagConnection(connection.id, { attributeTagIds: updatedAttributeIds });
        console.log(`Removed tag ${tagId} from connection ${connection.id} attributes`);
      }
    }
  }

  async resetAllTags(): Promise<{ cardsReset: number, tagsDeleted: number, linksCleared: number }> {
    let cardsReset = 0;
    let tagsDeleted = 0;
    let linksCleared = 0;
    
    // 1. Reset all card files - clear TAG INDEX, LINK INDEX, and remove tag markup from content
    const rawDir = path.join(USER_DATA_DIR, 'raw');
    try {
      const files = await fs.readdir(rawDir);
      for (const file of files) {
        if (!file.endsWith('.card.txt')) continue;
        
        const cardPath = path.join(rawDir, file);
        const content = await fs.readFile(cardPath, 'utf-8');
        
        const resetContent = this.resetCardContent(content);
        if (resetContent !== content) {
          await fs.writeFile(cardPath, resetContent, 'utf-8');
          cardsReset++;
        }
      }
    } catch (error) {
      console.error('Error resetting card files:', error);
    }
    
    // 2. Delete all tag files from all tag directories
    for (const dir of Object.values(TAG_DIRECTORIES)) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          // Delete tag files but not other files
          if (file.endsWith('.entity.txt') || file.endsWith('.relate.txt') || 
              file.endsWith('.attribute.txt') || file.endsWith('.comment.txt') ||
              file.endsWith('.label.txt') || file.endsWith('.data.txt') ||
              file.endsWith('.orcs')) {
            await fs.unlink(path.join(dir, file));
            tagsDeleted++;
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }
    
    // 3. Clear all connections
    const connections = await storage.getTagConnections();
    for (const connection of connections) {
      await storage.deleteTagConnection(connection.id);
      linksCleared++;
    }
    
    console.log(`Reset complete: ${cardsReset} cards reset, ${tagsDeleted} tags deleted, ${linksCleared} connections cleared`);
    return { cardsReset, tagsDeleted, linksCleared };
  }

  private resetCardContent(content: string): string {
    const lines = content.split('\n');
    const newLines: string[] = [];
    
    let inTagIndex = false;
    let inLinkIndex = false;
    let inSnippetIndex = false;
    let inOriginalContent = false;
    let inUserAdded = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (trimmedLine === '=== TAG INDEX START ===') {
        inTagIndex = true;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== TAG INDEX END ===') {
        inTagIndex = false;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== LINK INDEX START ===') {
        inLinkIndex = true;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== LINK INDEX END ===') {
        inLinkIndex = false;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== SNIPPET INDEX START ===') {
        inSnippetIndex = true;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== SNIPPET INDEX END ===') {
        inSnippetIndex = false;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== ORIGINAL CONTENT START ===') {
        inOriginalContent = true;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== ORIGINAL CONTENT END ===') {
        inOriginalContent = false;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== USER ADDED START ===') {
        inUserAdded = true;
        newLines.push(line);
        continue;
      }
      if (trimmedLine === '=== USER ADDED END ===') {
        inUserAdded = false;
        newLines.push(line);
        continue;
      }
      
      // Skip content in TAG INDEX, LINK INDEX, and SNIPPET INDEX sections (clearing them)
      if (inTagIndex || inLinkIndex || inSnippetIndex) {
        // Keep comment lines (like "# Format: ...")
        if (trimmedLine.startsWith('#')) {
          newLines.push(line);
        }
        continue;
      }
      
      // Remove tag markup from content sections
      if (inOriginalContent || inUserAdded) {
        // Replace [type:text](uuid) with just text
        const cleanedLine = line.replace(/\[([^\]:]+):([^\]]+)\]\([^)]+\)/g, '$2');
        newLines.push(cleanedLine);
        continue;
      }
      
      // Keep all other lines (metadata, etc.)
      newLines.push(line);
    }
    
    return newLines.join('\n');
  }

  private async adjustOffsetsAfterDeletion(deletedTag: Tag): Promise<void> {
    // No longer needed since offsets are handled inside cards
    // This method is kept for compatibility but does nothing
    return;
  }

  private async adjustFileTagOffsets(referenceBase: string, tags: Tag[], deletedTag: Tag): Promise<void> {
    // No longer needed since offsets are handled inside cards
    // This method is kept for compatibility but does nothing
    return;
  }

  private async findTagFile(tag: Tag): Promise<string | null> {
    const dir = TAG_DIRECTORIES[tag.type];
    const possibleExtensions = ['orcs', this.getFileExtension(tag.type)];
    
    for (const ext of possibleExtensions) {
      const filename = `${tag.name}_${tag.id}.${ext}`;
      const filepath = path.join(dir, filename);
      
      try {
        await fs.access(filepath);
        return filepath;
      } catch {
        // File doesn't exist, try next extension
      }
    }
    
    // Wikipedia approach: search all directories if not found in expected location
    return await this.searchAllDirectoriesForTag(tag);
  }

  private async searchAllDirectoriesForTag(tag: Tag): Promise<string | null> {
    for (const dir of Object.values(TAG_DIRECTORIES)) {
      try {
        const files = await fs.readdir(dir);
        for (const filename of files) {
          if (filename.includes(tag.id)) {
            const filepath = path.join(dir, filename);
            const content = await fs.readFile(filepath, 'utf-8');
            const parsedTag = this.parseTagFromOrcsFile(content);
            if (parsedTag && parsedTag.id === tag.id) {
              return filepath;
            }
          }
        }
      } catch {
        // Directory might not exist
      }
    }
    return null;
  }

  async generateGraphData(): Promise<GraphData> {
    const tags = await this.getTags();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create nodes for entities
    const entities = tags.filter(tag => tag.type === 'entity');
    entities.forEach((entity, index) => {
      nodes.push({
        id: entity.id,
        label: entity.name,
        type: entity.type,
        x: Math.cos(index * 2 * Math.PI / entities.length) * 100 + 200,
        y: Math.sin(index * 2 * Math.PI / entities.length) * 100 + 150,
      });
    });

    // Create edges for relationships
    const relationships = tags.filter(tag => tag.type === 'relationship');
    relationships.forEach(relationship => {
      // Parse relationship format: "entityA RELATION entityB" (supporting multi-word entities)
      const relationshipText = relationship.description || relationship.name;
      
      // Try to find a relationship verb/action in the middle
      const relationshipWords = ['ACQUIRED', 'OWNS', 'LEADS', 'WORKS_FOR', 'LOCATED_IN', 'PART_OF', 'CREATED', 'MANAGES'];
      let sourceEntity = '';
      let relationLabel = '';
      let targetEntity = '';
      
      for (const verb of relationshipWords) {
        if (relationshipText.includes(verb)) {
          const parts = relationshipText.split(verb);
          if (parts.length === 2) {
            sourceEntity = parts[0].trim();
            relationLabel = verb;
            targetEntity = parts[1].trim();
            break;
          }
        }
      }
      
      if (sourceEntity && targetEntity) {
        const sourceNode = nodes.find(node => 
          node.label.toLowerCase() === sourceEntity.toLowerCase() ||
          sourceEntity.toLowerCase().includes(node.label.toLowerCase()) ||
          node.label.toLowerCase().includes(sourceEntity.toLowerCase())
        );
        const targetNode = nodes.find(node => 
          node.label.toLowerCase() === targetEntity.toLowerCase() ||
          targetEntity.toLowerCase().includes(node.label.toLowerCase()) ||
          node.label.toLowerCase().includes(targetEntity.toLowerCase())
        );
        
        if (sourceNode && targetNode) {
          edges.push({
            id: relationship.id,
            source: sourceNode.id,
            target: targetNode.id,
            label: relationLabel.toLowerCase(),
            type: 'relationship',
            direction: 1,
            properties: {}
          });
        }
      }
    });

    // Add attribute nodes and connect them to related entities
    const attributes = tags.filter(tag => tag.type === 'attribute');
    attributes.forEach((attribute, index) => {
      // Add attribute as a smaller node
      nodes.push({
        id: attribute.id,
        label: attribute.name,
        type: attribute.type,
        x: 50 + (index * 80), // Position attributes along the bottom
        y: 300,
      });
      
      // Try to connect attribute to related entities or relationships
      const attrName = attribute.name.toLowerCase();
      const attrDesc = (attribute.description || '').toLowerCase();
      
      // First try to connect to relationships if attribute describes a relationship aspect
      let connected = false;
      relationships.forEach(relationship => {
        const relName = relationship.name.toLowerCase();
        const relDesc = (relationship.description || '').toLowerCase();
        
        if (attrName.includes(relName) || relDesc.includes(attrName.split('_')[0]) || 
            (attrName.includes('acquisition') && relName.includes('acquisition'))) {
          edges.push({
            id: `attr_${attribute.id}`,
            source: attribute.id,
            target: relationship.id,
            label: 'describes',
            type: 'attribute',
            direction: 0,
            properties: {}
          });
          connected = true;
        }
      });
      
      // If not connected to relationship, try entities
      if (!connected) {
        const relatedEntities = entities.filter(entity => {
          const entityName = entity.name.toLowerCase();
          return attrName.includes(entityName) || 
                 attrDesc.includes(entityName) ||
                 entityName.includes(attrName.split('_')[0]);
        });
        
        if (relatedEntities.length > 0) {
          edges.push({
            id: `attr_${attribute.id}`,
            source: attribute.id,
            target: relatedEntities[0].id,
            label: 'describes',
            type: 'attribute',
            direction: 0,
            properties: {}
          });
        }
      }
    });

    return { nodes, edges };
  }

  async generateGraphDataWithConnections(): Promise<GraphData> {
    const tags = await this.getTags();
    const connections = await storage.getTagConnections();
    
    // Create nodes for all tags
    const nodes: GraphNode[] = tags.map(tag => ({
      id: tag.id,
      label: tag.name,
      type: tag.type,
    }));

    const edges: GraphEdge[] = [];
    
    // Create edges from explicit tag connections
    for (const connection of connections) {
      // Find the relationship name if one exists
      let relationshipName = 'connected';
      if (connection.relationshipTagId) {
        const relationshipTag = tags.find(t => t.id === connection.relationshipTagId);
        relationshipName = relationshipTag?.name || 'connected';
      }

      // Main connection edge between source and target
      edges.push({
        id: connection.id,
        source: connection.sourceTagId,
        target: connection.targetTagId,
        label: relationshipName,
        type: 'connection',
        direction: connection.direction ?? 0,
        properties: {}
      });
      
      // Add edges for attribute connections
      for (const attributeId of connection.attributeTagIds) {
        edges.push({
          id: `${connection.id}-attr-${attributeId}`,
          source: connection.sourceTagId,
          target: attributeId,
          label: 'has attribute',
          type: 'attribute',
          direction: 0,
          properties: {}
        });
      }
    }
    
    // Fallback: create simple co-occurrence edges for unconnected entities
    const connectedTagIds = new Set([
      ...connections.flatMap(c => [c.sourceTagId, c.targetTagId, c.relationshipTagId, ...c.attributeTagIds].filter(Boolean))
    ]);
    
    const unconnectedEntities = tags.filter(tag => tag.type === 'entity' && !connectedTagIds.has(tag.id));
    for (let i = 0; i < unconnectedEntities.length; i++) {
      for (let j = i + 1; j < unconnectedEntities.length; j++) {
        const tag1 = unconnectedEntities[i];
        const tag2 = unconnectedEntities[j];
        
        // Check if they reference the same file (no offsets needed)
        const file1 = tag1.references[0];
        const file2 = tag2.references[0];
        
        if (file1 === file2) {
          edges.push({
            id: `co-occur-${tag1.id}-${tag2.id}`,
            source: tag1.id,
            target: tag2.id,
            label: 'co-occurs',
            type: 'co-occurrence',
            direction: 0,
            properties: {}
          });
        }
      }
    }

    return { nodes, edges };
  }

  getTagFilePath(tag: Tag): string {
    const dir = TAG_DIRECTORIES[tag.type];
    const extension = this.getFileExtension(tag.type);
    const filename = `${tag.name}_${tag.id}.${extension}`;
    return path.join(dir, filename);
  }

  private async saveTagToFile(tag: Tag): Promise<void> {
    const filepath = this.getTagFilePath(tag);
    
    const orcsContent = this.formatTagAsOrcs(tag);
    await fs.writeFile(filepath, orcsContent, 'utf-8');
  }

  private getFileExtension(tagType: TagType): string {
    const extensions: Record<string, string> = {
      entity: 'entity.txt',
      relationship: 'relate.txt',
      attribute: 'attrib.txt',
      comment: 'comment.txt',
      label: 'label.txt',
      data: 'data.txt',
    };
    return extensions[tagType] || 'orcs.txt';
  }

  async mergeTags(masterTagId: string, tagIdsToMerge: string[]): Promise<Tag> {
    const masterTag = await this.getTag(masterTagId);
    if (!masterTag) {
      throw new Error("Master tag not found");
    }

    // Get all tags to merge
    const tagsToMerge = await Promise.all(
      tagIdsToMerge.map(id => this.getTag(id))
    );
    
    // Filter out any tags that don't exist
    const validTagsToMerge = tagsToMerge.filter((tag): tag is Tag => tag !== undefined);
    
    if (validTagsToMerge.length === 0) {
      throw new Error("No valid tags to merge");
    }

    // Combine all data into master tag
    const allReferences = [...(masterTag.references || [])];
    const allAliases = [...(masterTag.aliases || [])];
    const allKeyValuePairs = { ...(masterTag.keyValuePairs || {}) };
    let combinedDescription = masterTag.description || '';

    // Merge data from each tag
    for (const tag of validTagsToMerge) {
      if (tag.references && tag.references.length > 0) {
        allReferences.push(...tag.references);
      }
      if (tag.aliases) {
        allAliases.push(...tag.aliases);
      }
      if (tag.keyValuePairs) {
        Object.assign(allKeyValuePairs, tag.keyValuePairs);
      }
      if (tag.description && tag.description !== combinedDescription) {
        combinedDescription += combinedDescription ? '\n\n' + tag.description : tag.description;
      }
    }

    // Remove duplicates from references and aliases
    const uniqueReferences = Array.from(new Set(allReferences));
    const uniqueAliases = Array.from(new Set(allAliases));

    // Update master tag with merged data
    const mergedData: Partial<Tag> = {
      references: uniqueReferences,
      aliases: uniqueAliases,
      keyValuePairs: allKeyValuePairs,
      description: combinedDescription,
      modified: new Date().toISOString()
    };

    const updatedMasterTag = await this.updateTag(masterTagId, mergedData);

    // Update all tag connections that reference the merged tags
    const allConnections = await storage.getTagConnections();
    for (const connection of allConnections) {
      let shouldUpdate = false;
      const updates: Partial<typeof connection> = {};

      // Update source tag references
      if (tagIdsToMerge.includes(connection.sourceTagId)) {
        updates.sourceTagId = masterTagId;
        shouldUpdate = true;
      }

      // Update target tag references
      if (tagIdsToMerge.includes(connection.targetTagId)) {
        updates.targetTagId = masterTagId;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        await storage.updateTagConnection(connection.id, updates);
      }
    }

    // Update card content with merged tag references
    await this.updateCardContent(updatedMasterTag);

    // Delete the merged tags
    for (const tagId of tagIdsToMerge) {
      await this.deleteTag(tagId);
    }

    return updatedMasterTag;
  }

  async removeTagFromCards(tag: Tag): Promise<void> {
    // Remove tag from all card files that reference it
    for (const cardFilename of tag.references || []) {
      if (!cardFilename.includes('.card.txt')) continue;
      
      try {
        const cardPath = path.join(process.cwd(), 'user_data', 'raw', cardFilename);
        const cardContent = await fs.readFile(cardPath, 'utf-8');
        
        // Split content into sections to handle them differently
        const sections = cardContent.split('=== ORIGINAL CONTENT START ===');
        if (sections.length < 2) {
          console.warn(`Card ${cardFilename} does not have expected format, skipping tag removal`);
          continue;
        }
        
        const beforeOriginalContent = sections[0];
        const afterOriginalContentStart = sections[1];
        const originalContentSections = afterOriginalContentStart.split('=== ORIGINAL CONTENT END ===');
        
        if (originalContentSections.length < 2) {
          console.warn(`Card ${cardFilename} does not have expected format, skipping tag removal`);
          continue;
        }
        
        const originalContent = originalContentSections[0];
        const afterOriginalContent = originalContentSections[1];
        
        // FIXED: Use a regex that matches by tag ID only, with non-greedy capture for the name
        // This handles cases where the tag name in the object differs from the original text
        // Pattern: [type:name](uuid) where name is non-greedy to avoid over-matching
        const tagByIdRegex = new RegExp(`\\[${tag.type}:([^\\]]+?)\\]\\(${tag.id}\\)`, 'g');
        
        // In TAG INDEX and metadata sections: completely remove the tag (including any trailing newline if line is now empty)
        const cleanTagFromSection = (content: string): string => {
          // First, replace the tag with empty string
          let cleaned = content.replace(tagByIdRegex, '');
          // Clean up any leftover empty lines that only have whitespace
          cleaned = cleaned.replace(/^\s*[\r\n]/gm, '\n');
          return cleaned;
        };
        
        const cleanedBeforeContent = cleanTagFromSection(beforeOriginalContent);
        const cleanedAfterContent = cleanTagFromSection(afterOriginalContent);
        
        // In ORIGINAL CONTENT section: replace tag with the CAPTURED TEXT (preserves original)
        // The $1 captures whatever text was actually in the brackets, not tag.name
        const cleanedOriginalContent = originalContent.replace(tagByIdRegex, '$1');
        
        // Reconstruct the card content
        const updatedContent = cleanedBeforeContent + 
                              '=== ORIGINAL CONTENT START ===' + 
                              cleanedOriginalContent + 
                              '=== ORIGINAL CONTENT END ===' + 
                              cleanedAfterContent;
        
        // Write the updated content back to the card
        await fs.writeFile(cardPath, updatedContent, 'utf-8');
        console.log(`Removed tag ${tag.name} from card: ${cardFilename}`);
      } catch (error) {
        console.error(`Failed to remove tag from card ${cardFilename}:`, error);
      }
    }
  }

  // Parse a reference string to extract section info
  // Supports formats:
  //   uuid#section@start-end (new format)
  //   uuid@start-end (legacy format, assumes 'original')
  //   filename@start-end (legacy format, assumes 'original')
  //   uuid#section[row,col] (CSV with section)
  //   uuid[row,col] (CSV legacy, assumes 'original')
  private parseReference(ref: string): { cardId: string; sectionId: 'original' | 'user_added'; offsets: string } {
    // Check for section marker: uuid#section@offsets or uuid#section[row,col]
    const sectionMatch = ref.match(/^([^#@\[]+)#(original|user_added)([@\[].*)?$/);
    if (sectionMatch) {
      return {
        cardId: sectionMatch[1],
        sectionId: sectionMatch[2] as 'original' | 'user_added',
        offsets: sectionMatch[3] || ''
      };
    }
    
    // Legacy format without section marker - assume 'original'
    const legacyMatch = ref.match(/^([^@\[]+)([@\[].*)?$/);
    if (legacyMatch) {
      return {
        cardId: legacyMatch[1],
        sectionId: 'original',
        offsets: legacyMatch[2] || ''
      };
    }
    
    return { cardId: ref, sectionId: 'original', offsets: '' };
  }

  private async updateCardContent(tag: Tag): Promise<void> {
    try {
      // Group references by card ID and collect sections to tag
      const cardSections = new Map<string, Set<'original' | 'user_added'>>();
      
      for (const cardRef of tag.references || []) {
        const { cardId, sectionId } = this.parseReference(cardRef);
        
        if (!cardSections.has(cardId)) {
          cardSections.set(cardId, new Set());
        }
        cardSections.get(cardId)!.add(sectionId);
      }
      
      // Update each card with the specified sections
      const cardEntries = Array.from(cardSections.entries());
      for (const [cardId, sections] of cardEntries) {
        // Try to find the card file
        let cardPath = path.join(process.cwd(), 'user_data', 'raw', cardId);
        
        // Check if cardId is a UUID - need to find the full filename
        if (cardId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
          try {
            const files = await fs.readdir(path.join(process.cwd(), 'user_data', 'raw'));
            const cardFile = files.find(f => f.includes(cardId) && f.endsWith('.card.txt'));
            if (cardFile) {
              cardPath = path.join(process.cwd(), 'user_data', 'raw', cardFile);
            }
          } catch (e) {
            console.error(`Failed to find card for UUID ${cardId}:`, e);
          }
        }
        
        try {
          const cardContent = await fs.readFile(cardPath, 'utf-8');
          const sectionsToTag: Array<'original' | 'user_added'> = Array.from(sections);
          const updatedContent = this.insertTagIntoCard(cardContent, tag, sectionsToTag);
          await fs.writeFile(cardPath, updatedContent, 'utf-8');
        } catch (error) {
          console.error(`Failed to update card content for ${cardId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to update card content:', error);
    }
  }

  // Insert tag markup into a card at the specified positions
  // Uses offset-based insertion from references when available, falls back to text matching
  private insertTagIntoCard(cardContent: string, tag: Tag, sectionsToTag?: Array<'original' | 'user_added'>): string {
    const lines = cardContent.split('\n');
    let tagIndexStart = -1;
    let tagIndexEnd = -1;
    let originalContentStart = -1;
    let originalContentEnd = -1;
    let userAddedStart = -1;
    let userAddedEnd = -1;

    // Find the boundaries of different sections
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '=== TAG INDEX START ===') {
        tagIndexStart = i;
      } else if (line === '=== TAG INDEX END ===') {
        tagIndexEnd = i;
      } else if (line === '=== ORIGINAL CONTENT START ===') {
        originalContentStart = i;
      } else if (line === '=== ORIGINAL CONTENT END ===') {
        originalContentEnd = i;
      } else if (line === '=== USER ADDED START ===') {
        userAddedStart = i;
      } else if (line === '=== USER ADDED END ===') {
        userAddedEnd = i;
      }
    }

    if (tagIndexStart === -1 || tagIndexEnd === -1 || originalContentStart === -1 || originalContentEnd === -1) {
      return cardContent; // Return unchanged if structure is not found
    }

    // Extract current content between ORIGINAL CONTENT markers
    let currentContent = lines.slice(originalContentStart + 1, originalContentEnd).join('\n');
    
    // Extract USER ADDED content if section exists
    let userAddedContent = '';
    if (userAddedStart !== -1 && userAddedEnd !== -1) {
      userAddedContent = lines.slice(userAddedStart + 1, userAddedEnd).join('\n');
    }
    
    // Check if already tagged
    const alreadyTaggedOriginal = currentContent.includes(`](${tag.id})`);
    const alreadyTaggedUserAdded = userAddedContent.includes(`](${tag.id})`);
    
    // Try offset-based insertion first using tag references
    let usedOffsetInsertion = false;
    for (const ref of tag.references || []) {
      const parsed = this.parseReference(ref);
      
      // Check for offset format: @start-end
      const offsetMatch = parsed.offsets.match(/@(\d+)-(\d+)/);
      if (offsetMatch) {
        const startOffset = parseInt(offsetMatch[1], 10);
        const endOffset = parseInt(offsetMatch[2], 10);
        
        if (parsed.sectionId === 'original' && !alreadyTaggedOriginal) {
          if (startOffset >= 0 && endOffset <= currentContent.length && startOffset < endOffset) {
            const selectedText = currentContent.substring(startOffset, endOffset);
            const tagMarkup = `[${tag.type}:${selectedText}](${tag.id})`;
            currentContent = currentContent.substring(0, startOffset) + tagMarkup + currentContent.substring(endOffset);
            usedOffsetInsertion = true;
          }
        } else if (parsed.sectionId === 'user_added' && !alreadyTaggedUserAdded && userAddedContent) {
          if (startOffset >= 0 && endOffset <= userAddedContent.length && startOffset < endOffset) {
            const selectedText = userAddedContent.substring(startOffset, endOffset);
            const tagMarkup = `[${tag.type}:${selectedText}](${tag.id})`;
            userAddedContent = userAddedContent.substring(0, startOffset) + tagMarkup + userAddedContent.substring(endOffset);
            usedOffsetInsertion = true;
          }
        }
      }
    }
    
    // Fallback to text-matching if no offset-based insertion happened
    if (!usedOffsetInsertion) {
      const tagOriginal = !sectionsToTag || sectionsToTag.includes('original');
      const tagUserAdded = !sectionsToTag || sectionsToTag.includes('user_added');
      
      if (tagOriginal && !alreadyTaggedOriginal) {
        currentContent = this.generateTagMarkup(currentContent, tag);
      }
      
      if (tagUserAdded && userAddedContent && !alreadyTaggedUserAdded) {
        userAddedContent = this.generateTagMarkup(userAddedContent, tag);
      }
    }
    
    // Update TAG INDEX section
    const existingTagIndex = lines.slice(tagIndexStart + 1, tagIndexEnd).filter(line => line.trim());
    const newTagEntry = `[${tag.type}:${tag.name}](${tag.id})`;
    if (!existingTagIndex.includes(newTagEntry)) {
      existingTagIndex.push(newTagEntry);
    }
    
    // Build new card content with updated sections
    let newLines: string[];
    
    if (userAddedStart !== -1 && userAddedEnd !== -1) {
      // Include USER ADDED section
      newLines = [
        ...lines.slice(0, tagIndexStart + 1),
        ...existingTagIndex,
        ...lines.slice(tagIndexEnd, originalContentStart + 1),
        currentContent,
        ...lines.slice(originalContentEnd, userAddedStart + 1),
        userAddedContent,
        ...lines.slice(userAddedEnd)
      ];
    } else {
      // No USER ADDED section yet
      newLines = [
        ...lines.slice(0, tagIndexStart + 1),
        ...existingTagIndex,
        ...lines.slice(tagIndexEnd, originalContentStart + 1),
        currentContent,
        ...lines.slice(originalContentEnd)
      ];
    }

    return newLines.join('\n');
  }
  
  // Verify card content integrity against original source file
  async verifyContentIntegrity(cardFilename: string): Promise<{
    isValid: boolean;
    missingText: string[];
    sourceFile: string | null;
    cardUuid: string | null;
  }> {
    try {
      const cardPath = path.join(USER_DATA_DIR, 'raw', cardFilename);
      const cardContent = await fs.readFile(cardPath, 'utf-8');
      
      // Extract card UUID and source file reference
      const uuidMatch = cardContent.match(/^uuid:\s*"([^"]+)"/m);
      const sourceFileMatch = cardContent.match(/^source_file:\s*"([^"]+)"/m);
      
      const cardUuid = uuidMatch ? uuidMatch[1] : null;
      const sourceFile = sourceFileMatch ? sourceFileMatch[1] : null;
      
      if (!sourceFile) {
        return { isValid: false, missingText: ['Source file reference not found in card'], sourceFile: null, cardUuid };
      }
      
      // Read original source file
      const sourcePath = path.join(USER_DATA_DIR, 'raw', sourceFile);
      let originalContent: string;
      try {
        originalContent = await fs.readFile(sourcePath, 'utf-8');
      } catch {
        return { isValid: false, missingText: ['Original source file not found: ' + sourceFile], sourceFile, cardUuid };
      }
      
      // Extract ORIGINAL CONTENT section from card
      const originalStartMatch = cardContent.match(/=== ORIGINAL CONTENT START ===/);
      const originalEndMatch = cardContent.match(/=== ORIGINAL CONTENT END ===/);
      
      if (!originalStartMatch || !originalEndMatch) {
        return { isValid: false, missingText: ['ORIGINAL CONTENT section not found in card'], sourceFile, cardUuid };
      }
      
      const startIdx = cardContent.indexOf('=== ORIGINAL CONTENT START ===') + '=== ORIGINAL CONTENT START ==='.length;
      const endIdx = cardContent.indexOf('=== ORIGINAL CONTENT END ===');
      const cardOriginalContent = cardContent.substring(startIdx, endIdx).trim();
      
      // Strip markdown tags from card content for comparison
      const strippedContent = this.stripTagsFromContent(cardOriginalContent);
      
      // Normalize content for comparison - handle both TXT and CSV formats
      const normalizeContent = (content: string): string => {
        // Preserve CSV structure by normalizing line-by-line, then join
        // This prevents false positives from CSV column/row differences
        return content
          .split('\n')
          .map(line => line.replace(/\s+/g, ' ').trim())
          .filter(line => line.length > 0)
          .join('\n')
          .toLowerCase(); // Case-insensitive comparison
      };
      
      const normalizedCard = normalizeContent(strippedContent);
      const normalizedOriginal = normalizeContent(originalContent);
      
      if (normalizedCard === normalizedOriginal) {
        return { isValid: true, missingText: [], sourceFile, cardUuid };
      }
      
      // Content doesn't match - find what's different for better error messages
      // Split on whitespace and common delimiters, filter out punctuation-only tokens
      const extractWords = (text: string): string[] => {
        return text
          .split(/[\s,\n\r]+/)
          .map(w => w.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase())
          .filter(w => w.length > 2);
      };
      
      const originalWords = extractWords(normalizedOriginal);
      const cardWordsList = extractWords(normalizedCard);
      const cardWords = new Set(cardWordsList);
      const originalWordsSet = new Set(originalWords);
      const missingText: string[] = [];
      const extraText: string[] = [];
      
      // Find words in original that are not in card (missing)
      for (const word of originalWords) {
        if (!cardWords.has(word)) {
          missingText.push(word);
        }
      }
      
      // Find words in card that are not in original (extra - could indicate corruption)
      for (const word of cardWordsList) {
        if (!originalWordsSet.has(word)) {
          extraText.push(word);
        }
      }
      
      const uniqueMissing = Array.from(new Set(missingText));
      const uniqueExtra = Array.from(new Set(extraText));
      
      // Always report as invalid since normalizedCard !== normalizedOriginal
      // Even if word sets match, the order/structure is different
      const differences: string[] = [];
      if (uniqueMissing.length > 0) {
        differences.push(...uniqueMissing.slice(0, 5));
      }
      if (uniqueExtra.length > 0 && differences.length < 5) {
        differences.push(...uniqueExtra.slice(0, 5 - differences.length).map(w => `+${w}`));
      }
      if (differences.length === 0) {
        // Words match but order is different
        differences.push('(content order mismatch)');
      }
      
      return { isValid: false, missingText: differences, sourceFile, cardUuid };
    } catch (error) {
      console.error('Failed to verify content integrity:', error);
      return { isValid: false, missingText: ['Error reading files'], sourceFile: null, cardUuid: null };
    }
  }

  // Restore original content from source file, preserving tag index and user added section
  async restoreOriginalContent(cardFilename: string): Promise<{
    success: boolean;
    cardUuid: string | null;
    message: string;
  }> {
    try {
      const cardPath = path.join(USER_DATA_DIR, 'raw', cardFilename);
      const cardContent = await fs.readFile(cardPath, 'utf-8');
      
      // Extract card UUID and source file reference
      const uuidMatch = cardContent.match(/^uuid:\s*"([^"]+)"/m);
      const sourceFileMatch = cardContent.match(/^source_file:\s*"([^"]+)"/m);
      
      const cardUuid = uuidMatch ? uuidMatch[1] : null;
      const sourceFile = sourceFileMatch ? sourceFileMatch[1] : null;
      
      if (!sourceFile) {
        return { success: false, cardUuid, message: 'Source file reference not found in card' };
      }
      
      // Read original source file
      const sourcePath = path.join(USER_DATA_DIR, 'raw', sourceFile);
      let originalContent: string;
      try {
        originalContent = await fs.readFile(sourcePath, 'utf-8');
      } catch {
        return { success: false, cardUuid, message: 'Original source file not found: ' + sourceFile };
      }
      
      // Parse card sections
      const lines = cardContent.split('\n');
      
      // Find section boundaries
      let headerEnd = -1;
      let tagIndexStart = -1;
      let tagIndexEnd = -1;
      let originalContentStart = -1;
      let originalContentEnd = -1;
      let userAddedStart = -1;
      let userAddedEnd = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '=== TAG INDEX START ===') tagIndexStart = i;
        else if (line === '=== TAG INDEX END ===') tagIndexEnd = i;
        else if (line === '=== ORIGINAL CONTENT START ===') originalContentStart = i;
        else if (line === '=== ORIGINAL CONTENT END ===') originalContentEnd = i;
        else if (line === '=== USER ADDED START ===') userAddedStart = i;
        else if (line === '=== USER ADDED END ===') userAddedEnd = i;
      }
      
      if (originalContentStart === -1 || originalContentEnd === -1) {
        return { success: false, cardUuid, message: 'ORIGINAL CONTENT section not found in card' };
      }
      
      // Build restored card content
      const newLines: string[] = [];
      
      // Add header (everything before TAG INDEX or ORIGINAL CONTENT)
      headerEnd = tagIndexStart !== -1 ? tagIndexStart : originalContentStart;
      for (let i = 0; i < headerEnd; i++) {
        newLines.push(lines[i]);
      }
      
      // Clear tag index but keep section markers
      if (tagIndexStart !== -1 && tagIndexEnd !== -1) {
        newLines.push('=== TAG INDEX START ===');
        newLines.push('=== TAG INDEX END ===');
        newLines.push('');
      }
      
      // Add restored original content
      newLines.push('=== ORIGINAL CONTENT START ===');
      newLines.push(originalContent.trim());
      newLines.push('=== ORIGINAL CONTENT END ===');
      
      // Preserve USER ADDED section if it exists
      if (userAddedStart !== -1 && userAddedEnd !== -1) {
        newLines.push('');
        for (let i = userAddedStart; i <= userAddedEnd; i++) {
          newLines.push(lines[i]);
        }
      }
      
      await fs.writeFile(cardPath, newLines.join('\n'), 'utf-8');
      console.log(`Restored original content for card: ${cardFilename}`);
      return { success: true, cardUuid, message: 'Content restored from original source file' };
    } catch (error) {
      console.error('Failed to restore original content:', error);
      return { success: false, cardUuid: null, message: 'Error restoring content' };
    }
  }

  // Helper: Strip markdown-style tags from content to get plain text
  private stripTagsFromContent(content: string): string {
    // Match all tag formats: entity, relationship, attribute, comment, label, data
    const tagPattern = /\[(entity|relationship|attribute|comment|label|data):([^\]]+)\]\([a-f0-9-]+\)/gi;
    return content.replace(tagPattern, '$2');
  }

  private generateTagMarkup(content: string, tag: Tag): string {
    let markedContent = content;
    
    // Find occurrences of the tag name and its aliases in the content
    const searchTerms = [tag.name, ...(tag.aliases || [])];
    
    for (const term of searchTerms) {
      // Escape special regex characters and create case-insensitive regex
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
      
      // Only replace if not already tagged with any tag ID
      markedContent = markedContent.replace(regex, (match) => {
        // Don't replace if already inside markdown tag syntax
        const beforeMatch = markedContent.substring(0, markedContent.indexOf(match));
        const afterMatch = markedContent.substring(markedContent.indexOf(match) + match.length);
        
        if (beforeMatch.includes('[') && afterMatch.startsWith('](')) {
          return match; // Already tagged
        }
        
        return `[${tag.type}:${match}](${tag.id})`;
      });
    }
    
    return markedContent;
  }

  private formatTagAsOrcs(tag: Tag): string {
    const lines = [
      '=== ORCS ENTITY ===',
      'VERSION: 1.0',
      `UUID: ${tag.id}`,
      `TAG_TYPE: ${tag.type}`,
      `NAME: ${tag.name}`,
      `CREATED: ${tag.created}`,
      `MODIFIED: ${tag.modified}`,
      '',
      'SEARCH_ALIASES:',
      ...tag.aliases.map(alias => `  - ${alias}`),
      '',
      'CARD_REFERENCES:',
      ...tag.references.map(ref => `  - ${ref}`),
      '',
    ];

    if (tag.entityType) {
      lines.splice(5, 0, `ENTITY_TYPE: ${tag.entityType}`);
    }

    if (Object.keys(tag.keyValuePairs).length > 0) {
      lines.push('KEY_VALUE_PAIRS:');
      lines.push(...Object.entries(tag.keyValuePairs).map(([k, v]) => `  ${k}: ${v}`));
      lines.push('');
    }

    if (tag.description) {
      lines.push('DESCRIPTION:');
      lines.push(tag.description);
      lines.push('');
    }

    lines.push('=== END ORCS ENTITY ===');
    
    return lines.join('\n');
  }

  private parseTagFromOrcsFile(content: string): Tag | null {
    const lines = content.split('\n');
    const tag: Partial<Tag> = {
      aliases: [],
      keyValuePairs: {},
    };

    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('UUID:')) {
        tag.id = trimmed.substring(5).trim();
      } else if (trimmed.startsWith('TYPE:') || trimmed.startsWith('TAG_TYPE:')) {
        const typeValue = trimmed.startsWith('TAG_TYPE:') ? 
          trimmed.substring(9).trim() : 
          trimmed.substring(5).trim();
        tag.type = typeValue as TagType;
      } else if (trimmed.startsWith('NAME:')) {
        tag.name = trimmed.substring(5).trim();
      } else if (trimmed.startsWith('# Entity:') || trimmed.startsWith('# Relationship:') || trimmed.startsWith('# Attribute:') || trimmed.startsWith('# Comment:') || trimmed.startsWith('# KV Pair:')) {
        // Extract name from markdown header format
        const parts = trimmed.split(':');
        if (parts.length > 1) {
          tag.name = parts[1].trim();
        }
      } else if (trimmed.startsWith('ENTITY_TYPE:')) {
        tag.entityType = trimmed.substring(12).trim();
      } else if (trimmed.startsWith('DESCRIPTION:')) {
        const desc = trimmed.substring(12).trim();
        if (desc) {
          tag.description = desc;
        } else {
          currentSection = 'description';
        }
      } else if (trimmed.startsWith('REFERENCE:') || trimmed.startsWith('REFERENCES:') || trimmed === 'CARD_REFERENCES:') {
        if (trimmed === 'CARD_REFERENCES:') {
          currentSection = 'card_references';
        } else {
          const refString = trimmed.startsWith('REFERENCES:') ? 
            trimmed.substring(11).trim() : 
            trimmed.substring(10).trim();
          // Remove any offset portions from legacy references
          tag.references = refString.split(',').map(ref => {
            const cleanRef = ref.trim();
            // Remove @offset-offset if present
            return cleanRef.split('@')[0];
          }).filter(ref => ref);
        }
      } else if (currentSection === 'card_references' && trimmed.startsWith('- ')) {
        if (!tag.references) tag.references = [];
        const ref = trimmed.substring(2).trim();
        // Remove any offset portions from card references
        tag.references.push(ref.split('@')[0]);
      } else if (trimmed.startsWith('CREATED:')) {
        tag.created = trimmed.substring(8).trim();
      } else if (trimmed.startsWith('MODIFIED:')) {
        tag.modified = trimmed.substring(9).trim();
      } else if (trimmed === 'ALIASES:' || trimmed === 'SEARCH_ALIASES:') {
        currentSection = 'aliases';
      } else if (trimmed === 'KEY_VALUE_PAIRS:') {
        currentSection = 'kvp';
      } else if (trimmed === 'RELATIONSHIPS:' || trimmed === 'ATTRIBUTES:') {
        // Skip these sections for now - they're metadata, not part of the core tag
        currentSection = 'skip';
      } else if (currentSection === 'aliases' && trimmed.startsWith('- ')) {
        const alias = trimmed.substring(2).trim();
        // Remove quotes if present
        const cleanAlias = alias.replace(/^["']|["']$/g, '');
        tag.aliases!.push(cleanAlias);
      } else if (currentSection === 'kvp' && trimmed.startsWith('- ')) {
        const kvLine = trimmed.substring(2).trim();
        if (kvLine.includes(':')) {
          const [key, ...valueParts] = kvLine.split(':');
          const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
          tag.keyValuePairs![key.trim()] = value;
        }
      } else if (currentSection === 'description' && trimmed && !trimmed.startsWith('===')) {
        tag.description = (tag.description || '') + trimmed + '\n';
      } else if (currentSection === 'skip') {
        // Skip content in sections we don't process
        continue;
      }
    }

    // Clean up description if it exists
    if (tag.description) {
      tag.description = tag.description.trim();
    }

    // Validate required fields - for entity files, we need at least id, type, and card references
    if (tag.id && tag.type && tag.references && tag.references.length > 0 && tag.created && tag.modified) {
      // If no explicit name, try to extract from the first line or use the type
      if (!tag.name) {
        const firstLine = lines[0];
        if (firstLine.includes('===') && firstLine.includes('ENTITY')) {
          tag.name = 'Entity'; // Default name
        }
      }
      return tag as Tag;
    }
    
    return null;
  }

  // =====================================================================
  // LINK CRUD OPERATIONS
  // =====================================================================

  async createLink(insertLink: Omit<InsertLink, 'sourceCardId'>, cardId: string): Promise<Link> {
    const linkId = uuidv4();
    const now = new Date().toISOString();
    
    const link: Link = {
      sourceId: insertLink.sourceId,
      targetId: insertLink.targetId,
      predicate: insertLink.predicate,
      isRelationship: insertLink.isRelationship ?? true,
      isAttribute: insertLink.isAttribute ?? false,
      isNormalization: insertLink.isNormalization ?? false,
      direction: insertLink.direction ?? 1,
      properties: insertLink.properties ?? {},
      offsets: insertLink.offsets,
      id: linkId,
      sourceCardId: cardId,
      created: now,
      modified: now,
    };

    // Add link to card's LINK INDEX
    await this.addLinkToCard(cardId, link);
    
    return link;
  }

  async getLinksFromCard(cardId: string): Promise<Link[]> {
    try {
      const cardPath = await this.findCardPath(cardId);
      if (!cardPath) return [];
      
      const content = await fs.readFile(cardPath, 'utf-8');
      return this.parseLinkIndex(content, cardId);
    } catch (error) {
      console.error(`Failed to get links from card ${cardId}:`, error);
      return [];
    }
  }

  async updateLink(cardId: string, linkId: string, updates: Partial<Link>): Promise<Link | null> {
    const links = await this.getLinksFromCard(cardId);
    const linkIndex = links.findIndex(l => l.id === linkId);
    
    if (linkIndex === -1) return null;
    
    const existingLink = links[linkIndex];
    
    const updatedLink: Link = {
      id: linkId,
      sourceCardId: existingLink.sourceCardId,
      created: existingLink.created,
      modified: new Date().toISOString(),
      sourceId: updates.sourceId != null ? updates.sourceId : existingLink.sourceId,
      targetId: updates.targetId != null ? updates.targetId : existingLink.targetId,
      predicate: updates.predicate != null ? updates.predicate : existingLink.predicate,
      isRelationship: updates.isRelationship != null ? updates.isRelationship : existingLink.isRelationship,
      isAttribute: updates.isAttribute != null ? updates.isAttribute : existingLink.isAttribute,
      isNormalization: updates.isNormalization != null ? updates.isNormalization : existingLink.isNormalization,
      direction: updates.direction != null ? updates.direction : existingLink.direction,
      properties: updates.properties != null ? updates.properties : existingLink.properties,
      offsets: updates.offsets !== undefined ? updates.offsets : existingLink.offsets,
    };
    
    links[linkIndex] = updatedLink;
    await this.updateCardLinkIndex(cardId, links);
    
    return updatedLink;
  }

  async deleteLink(cardId: string, linkId: string): Promise<boolean> {
    const links = await this.getLinksFromCard(cardId);
    const filteredLinks = links.filter(l => l.id !== linkId);
    
    if (filteredLinks.length === links.length) return false;
    
    await this.updateCardLinkIndex(cardId, filteredLinks);
    return true;
  }

  private async addLinkToCard(cardId: string, link: Link): Promise<void> {
    const links = await this.getLinksFromCard(cardId);
    links.push(link);
    await this.updateCardLinkIndex(cardId, links);
  }

  private async updateCardLinkIndex(cardId: string, links: Link[]): Promise<void> {
    const cardPath = await this.findCardPath(cardId);
    if (!cardPath) {
      throw new Error(`Card not found: ${cardId}`);
    }
    
    const content = await fs.readFile(cardPath, 'utf-8');
    const updatedContent = this.replaceLinkIndex(content, links);
    await fs.writeFile(cardPath, updatedContent, 'utf-8');
  }

  private parseLinkIndex(cardContent: string, cardId: string): Link[] {
    const links: Link[] = [];
    const lines = cardContent.split('\n');
    let inLinkIndex = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '=== LINK INDEX START ===') {
        inLinkIndex = true;
        continue;
      }
      if (trimmed === '=== LINK INDEX END ===') {
        inLinkIndex = false;
        continue;
      }
      
      if (inLinkIndex && !trimmed.startsWith('#') && trimmed.length > 0) {
        const link = this.parseLinkLine(trimmed, cardId);
        if (link) {
          links.push(link);
        }
      }
    }
    
    return links;
  }

  private parseLinkLine(line: string, cardId: string): Link | null {
    // Format: (sourceUUID) --[PREDICATE:prop=value]--> (targetUUID) {flags} |id:uuid
    const match = line.match(/^\(([^)]+)\)\s*--\[([^\]]+)\]-->\s*\(([^)]+)\)\s*(\{[^}]*\})?\s*\|id:([a-f0-9-]+)$/);
    
    if (!match) return null;
    
    const [, sourceId, predicatePart, targetId, flagsPart, id] = match;
    
    // Parse predicate and properties: PREDICATE:key=value,key2=value2
    const colonIndex = predicatePart.indexOf(':');
    let predicate: string;
    const properties: Record<string, string> = {};
    
    if (colonIndex !== -1) {
      predicate = predicatePart.substring(0, colonIndex);
      const propsStr = predicatePart.substring(colonIndex + 1);
      propsStr.split(',').forEach(prop => {
        const [key, value] = prop.split('=');
        if (key && value) {
          properties[key.trim()] = value.trim();
        }
      });
    } else {
      predicate = predicatePart;
    }
    
    // Parse flags: {rel: true, attr: false}
    let isRelationship = true;
    let isAttribute = false;
    let isNormalization = false;
    let direction: 0 | 1 | 2 | 3 = 1;
    
    if (flagsPart) {
      const flagsStr = flagsPart.slice(1, -1); // Remove { }
      if (flagsStr.includes('rel: true') || flagsStr.includes('rel:true')) isRelationship = true;
      if (flagsStr.includes('rel: false') || flagsStr.includes('rel:false')) isRelationship = false;
      if (flagsStr.includes('attr: true') || flagsStr.includes('attr:true')) isAttribute = true;
      if (flagsStr.includes('norm: true') || flagsStr.includes('norm:true')) isNormalization = true;
      const dirMatch = flagsStr.match(/dir:\s*(\d)/);
      if (dirMatch) direction = parseInt(dirMatch[1]) as 0 | 1 | 2 | 3;
    }
    
    return {
      id,
      sourceId,
      targetId,
      predicate,
      isRelationship,
      isAttribute,
      isNormalization,
      direction,
      properties,
      sourceCardId: cardId,
      offsets: undefined,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };
  }

  private formatLinkLine(link: Link): string {
    // Format: (sourceUUID) --[PREDICATE:prop=value]--> (targetUUID) {flags} |id:uuid
    let predicatePart = link.predicate;
    if (Object.keys(link.properties).length > 0) {
      const propsStr = Object.entries(link.properties).map(([k, v]) => `${k}=${v}`).join(',');
      predicatePart = `${link.predicate}:${propsStr}`;
    }
    
    const flags: string[] = [];
    flags.push(`rel: ${link.isRelationship}`);
    flags.push(`attr: ${link.isAttribute}`);
    if (link.isNormalization) flags.push('norm: true');
    if (link.direction !== 1) flags.push(`dir: ${link.direction}`);
    
    return `(${link.sourceId}) --[${predicatePart}]--> (${link.targetId}) {${flags.join(', ')}} |id:${link.id}`;
  }

  private replaceLinkIndex(cardContent: string, links: Link[]): string {
    const lines = cardContent.split('\n');
    const result: string[] = [];
    let inLinkIndex = false;
    let linkIndexFound = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '=== LINK INDEX START ===') {
        linkIndexFound = true;
        inLinkIndex = true;
        result.push(line);
        result.push('# Format: (SourceUUID) --[PREDICATE:prop=value]--> (TargetUUID) {flags} |id:uuid');
        links.forEach(link => {
          result.push(this.formatLinkLine(link));
        });
        continue;
      }
      
      if (trimmed === '=== LINK INDEX END ===') {
        inLinkIndex = false;
        result.push(line);
        continue;
      }
      
      if (!inLinkIndex) {
        result.push(line);
      }
    }
    
    // If no LINK INDEX section found, create one before SNIPPET INDEX or ORIGINAL CONTENT
    if (!linkIndexFound) {
      const insertPoint = result.findIndex(l => 
        l.trim() === '=== SNIPPET INDEX START ===' || 
        l.trim() === '=== ORIGINAL CONTENT START ==='
      );
      
      if (insertPoint !== -1) {
        const linkSection = [
          '=== LINK INDEX START ===',
          '# Format: (SourceUUID) --[PREDICATE:prop=value]--> (TargetUUID) {flags} |id:uuid',
          ...links.map(l => this.formatLinkLine(l)),
          '=== LINK INDEX END ===',
          ''
        ];
        result.splice(insertPoint, 0, ...linkSection);
      }
    }
    
    return result.join('\n');
  }

  // =====================================================================
  // SNIPPET CRUD OPERATIONS
  // =====================================================================

  async createSnippet(insertSnippet: InsertSnippet): Promise<Snippet> {
    const snippetId = uuidv4();
    const now = new Date().toISOString();
    
    const snippet: Snippet = {
      ...insertSnippet,
      id: snippetId,
      created: now,
    };

    await this.addSnippetToCard(insertSnippet.cardId, snippet);
    
    return snippet;
  }

  async getSnippetsFromCard(cardId: string): Promise<Snippet[]> {
    try {
      const cardPath = await this.findCardPath(cardId);
      if (!cardPath) return [];
      
      const content = await fs.readFile(cardPath, 'utf-8');
      return this.parseSnippetIndex(content, cardId);
    } catch (error) {
      console.error(`Failed to get snippets from card ${cardId}:`, error);
      return [];
    }
  }

  async updateSnippet(cardId: string, snippetId: string, updates: Partial<Snippet>): Promise<Snippet | null> {
    const snippets = await this.getSnippetsFromCard(cardId);
    const snippetIndex = snippets.findIndex(s => s.id === snippetId);
    
    if (snippetIndex === -1) return null;
    
    const existingSnippet = snippets[snippetIndex];
    
    const updatedSnippet: Snippet = {
      id: snippetId,
      cardId: existingSnippet.cardId,
      text: updates.text != null ? updates.text : existingSnippet.text,
      offsets: updates.offsets != null ? updates.offsets : existingSnippet.offsets,
      comment: updates.comment !== undefined ? updates.comment : existingSnippet.comment,
      analyst: updates.analyst !== undefined ? updates.analyst : existingSnippet.analyst,
      classification: updates.classification !== undefined ? updates.classification : existingSnippet.classification,
      created: existingSnippet.created,
    };
    
    snippets[snippetIndex] = updatedSnippet;
    await this.updateCardSnippetIndex(cardId, snippets);
    
    return updatedSnippet;
  }

  async deleteSnippet(cardId: string, snippetId: string): Promise<boolean> {
    const snippets = await this.getSnippetsFromCard(cardId);
    const filteredSnippets = snippets.filter(s => s.id !== snippetId);
    
    if (filteredSnippets.length === snippets.length) return false;
    
    await this.updateCardSnippetIndex(cardId, filteredSnippets);
    return true;
  }

  private async addSnippetToCard(cardId: string, snippet: Snippet): Promise<void> {
    const snippets = await this.getSnippetsFromCard(cardId);
    snippets.push(snippet);
    await this.updateCardSnippetIndex(cardId, snippets);
  }

  private async updateCardSnippetIndex(cardId: string, snippets: Snippet[]): Promise<void> {
    const cardPath = await this.findCardPath(cardId);
    if (!cardPath) {
      throw new Error(`Card not found: ${cardId}`);
    }
    
    const content = await fs.readFile(cardPath, 'utf-8');
    const updatedContent = this.replaceSnippetIndex(content, snippets);
    await fs.writeFile(cardPath, updatedContent, 'utf-8');
  }

  private parseSnippetIndex(cardContent: string, cardId: string): Snippet[] {
    const snippets: Snippet[] = [];
    const lines = cardContent.split('\n');
    let inSnippetIndex = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '=== SNIPPET INDEX START ===') {
        inSnippetIndex = true;
        continue;
      }
      if (trimmed === '=== SNIPPET INDEX END ===') {
        inSnippetIndex = false;
        continue;
      }
      
      if (inSnippetIndex && !trimmed.startsWith('#') && trimmed.length > 0) {
        const snippet = this.parseSnippetLine(trimmed, cardId);
        if (snippet) {
          snippets.push(snippet);
        }
      }
    }
    
    return snippets;
  }

  private parseSnippetLine(line: string, cardId: string): Snippet | null {
    // Format: [start-end] "text" | {comment: "...", analyst: "...", class: "..."} |id:uuid
    const match = line.match(/^\[(\d+)-(\d+)\]\s*"([^"]*)"\s*\|\s*(\{[^}]*\})?\s*\|id:([a-f0-9-]+)$/);
    
    if (!match) return null;
    
    const [, startStr, endStr, text, metaPart, id] = match;
    
    let comment: string | undefined;
    let analyst: string | undefined;
    let classification: string | undefined;
    
    if (metaPart) {
      const metaStr = metaPart.slice(1, -1); // Remove { }
      const commentMatch = metaStr.match(/comment:\s*"([^"]*)"/);
      const analystMatch = metaStr.match(/analyst:\s*"([^"]*)"/);
      const classMatch = metaStr.match(/class:\s*"([^"]*)"/);
      
      if (commentMatch) comment = commentMatch[1];
      if (analystMatch) analyst = analystMatch[1];
      if (classMatch) classification = classMatch[1];
    }
    
    return {
      id,
      cardId,
      text,
      offsets: {
        start: parseInt(startStr),
        end: parseInt(endStr),
      },
      comment,
      analyst,
      classification,
      created: new Date().toISOString(),
    };
  }

  private formatSnippetLine(snippet: Snippet): string {
    // Format: [start-end] "text" | {comment: "...", analyst: "...", class: "..."} |id:uuid
    const meta: string[] = [];
    if (snippet.comment) meta.push(`comment: "${snippet.comment}"`);
    if (snippet.analyst) meta.push(`analyst: "${snippet.analyst}"`);
    if (snippet.classification) meta.push(`class: "${snippet.classification}"`);
    
    const metaPart = meta.length > 0 ? `{${meta.join(', ')}}` : '{}';
    const escapedText = snippet.text.replace(/"/g, '\\"');
    
    return `[${snippet.offsets.start}-${snippet.offsets.end}] "${escapedText}" | ${metaPart} |id:${snippet.id}`;
  }

  private replaceSnippetIndex(cardContent: string, snippets: Snippet[]): string {
    const lines = cardContent.split('\n');
    const result: string[] = [];
    let inSnippetIndex = false;
    let snippetIndexFound = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '=== SNIPPET INDEX START ===') {
        snippetIndexFound = true;
        inSnippetIndex = true;
        result.push(line);
        result.push('# Format: [start-end] "text" | {metadata} |id:uuid');
        snippets.forEach(snippet => {
          result.push(this.formatSnippetLine(snippet));
        });
        continue;
      }
      
      if (trimmed === '=== SNIPPET INDEX END ===') {
        inSnippetIndex = false;
        result.push(line);
        continue;
      }
      
      if (!inSnippetIndex) {
        result.push(line);
      }
    }
    
    // If no SNIPPET INDEX section found, create one before ORIGINAL CONTENT
    if (!snippetIndexFound) {
      const insertPoint = result.findIndex(l => 
        l.trim() === '=== ORIGINAL CONTENT START ==='
      );
      
      if (insertPoint !== -1) {
        const snippetSection = [
          '=== SNIPPET INDEX START ===',
          '# Format: [start-end] "text" | {metadata} |id:uuid',
          ...snippets.map(s => this.formatSnippetLine(s)),
          '=== SNIPPET INDEX END ===',
          ''
        ];
        result.splice(insertPoint, 0, ...snippetSection);
      }
    }
    
    return result.join('\n');
  }

  // =====================================================================
  // BULLET GENERATION (Derived from Links)
  // =====================================================================

  async generateBulletsFromCard(cardId: string): Promise<Bullet[]> {
    const links = await this.getLinksFromCard(cardId);
    const bullets: Bullet[] = [];
    
    for (const link of links) {
      if (!link.isRelationship && !link.isAttribute) continue;
      
      // Get source and target entities
      const sourceEntity = await this.getEntityById(link.sourceId);
      const targetEntity = await this.getEntityById(link.targetId);
      
      if (!sourceEntity || !targetEntity) continue;
      
      const bullet: Bullet = {
        subject: sourceEntity,
        predicate: link.predicate,
        predicateProperties: link.properties,
        object: targetEntity,
        isRelationship: link.isRelationship,
        isAttribute: link.isAttribute,
        direction: link.direction,
        sourceCardId: link.sourceCardId,
        sourceCardName: '', // TODO: Get from card filename
        classification: 'unclassified', // TODO: Get from card metadata
        linkId: link.id,
      };
      
      bullets.push(bullet);
    }
    
    return bullets;
  }

  private async getEntityById(entityId: string): Promise<Entity | undefined> {
    // Try to find entity tag and convert to Entity interface
    const tags = await this.getTagsByType('entity');
    const tag = tags.find(t => t.id === entityId);
    
    if (!tag) return undefined;
    
    // Map tag entityType to valid Entity type, default to 'object' if unknown
    const validTypes = ['person', 'org', 'location', 'selector', 'date', 'event', 'object', 'concept'] as const;
    const entityType = validTypes.includes(tag.entityType as any) 
      ? (tag.entityType as typeof validTypes[number])
      : 'object';
    
    return {
      id: tag.id,
      type: entityType,
      canonicalName: tag.name,
      displayName: tag.name,
      aliases: tag.aliases || [],
      properties: tag.keyValuePairs || {},
      created: tag.created || new Date().toISOString(),
      modified: tag.modified || new Date().toISOString(),
    };
  }

  // =====================================================================
  // DOSSIER AGGREGATION
  // =====================================================================

  async buildDossier(entityId: string): Promise<{
    entity: Entity | undefined;
    cards: string[];
    snippets: Snippet[];
    bullets: Bullet[];
    relationships: Bullet[];
    attributes: Bullet[];
  }> {
    const entity = await this.getEntityById(entityId);
    if (!entity) {
      return {
        entity: undefined,
        cards: [],
        snippets: [],
        bullets: [],
        relationships: [],
        attributes: [],
      };
    }
    
    // Find all cards that have links involving this entity
    const allCardIds = await this.getAllCardIds();
    const relevantCards: string[] = [];
    const allSnippets: Snippet[] = [];
    const allBullets: Bullet[] = [];
    
    for (const cardId of allCardIds) {
      const links = await this.getLinksFromCard(cardId);
      const hasEntity = links.some(l => l.sourceId === entityId || l.targetId === entityId);
      
      if (hasEntity) {
        relevantCards.push(cardId);
        
        // Get snippets from this card
        const snippets = await this.getSnippetsFromCard(cardId);
        allSnippets.push(...snippets);
        
        // Generate bullets for links involving this entity
        for (const link of links) {
          if ((link.sourceId === entityId || link.targetId === entityId) && 
              (link.isRelationship || link.isAttribute)) {
            const sourceEntity = await this.getEntityById(link.sourceId);
            const targetEntity = await this.getEntityById(link.targetId);
            
            if (sourceEntity && targetEntity) {
              allBullets.push({
                subject: sourceEntity,
                predicate: link.predicate,
                predicateProperties: link.properties,
                object: targetEntity,
                isRelationship: link.isRelationship,
                isAttribute: link.isAttribute,
                direction: link.direction,
                sourceCardId: link.sourceCardId,
                sourceCardName: '',
                classification: 'unclassified',
                linkId: link.id,
              });
            }
          }
        }
      }
    }
    
    return {
      entity,
      cards: relevantCards,
      snippets: allSnippets,
      bullets: allBullets,
      relationships: allBullets.filter(b => b.isRelationship),
      attributes: allBullets.filter(b => b.isAttribute),
    };
  }

  private async getAllCardIds(): Promise<string[]> {
    const cardIds: string[] = [];
    const rawDir = path.join(USER_DATA_DIR, 'raw');
    
    try {
      const files = await fs.readdir(rawDir);
      for (const file of files) {
        if (file.endsWith('.card.txt')) {
          // Extract UUID from filename (format: name_uuid.card.txt)
          const uuidMatch = file.match(/([a-f0-9-]{36})\.card\.txt$/);
          if (uuidMatch) {
            cardIds.push(uuidMatch[1]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to list card files:', error);
    }
    
    return cardIds;
  }

  private async findCardPath(cardId: string): Promise<string | null> {
    const rawDir = path.join(USER_DATA_DIR, 'raw');
    
    try {
      const files = await fs.readdir(rawDir);
      const cardFile = files.find(f => f.includes(cardId) && f.endsWith('.card.txt'));
      if (cardFile) {
        return path.join(rawDir, cardFile);
      }
    } catch (error) {
      console.error(`Failed to find card ${cardId}:`, error);
    }
    
    return null;
  }
}

export const orcsService = new OrcsService();
