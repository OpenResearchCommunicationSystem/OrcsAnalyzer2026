import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Tag, InsertTag, TagType, GraphData, GraphNode, GraphEdge } from '@shared/schema';
import { storage } from '../storage';

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');

const TAG_DIRECTORIES = {
  entity: path.join(USER_DATA_DIR, 'entities'),
  relationship: path.join(USER_DATA_DIR, 'relationships'),
  attribute: path.join(USER_DATA_DIR, 'attributes'),
  comment: path.join(USER_DATA_DIR, 'comments'),
  kv_pair: path.join(USER_DATA_DIR, 'kv_pairs'),
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
      'entity.txt', 'relate.txt', 'attrib.txt', 'comment.txt', 'kv.txt', 'orcs'
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

  async deleteTag(tagId: string): Promise<boolean> {
    const tag = await this.getTag(tagId);
    if (!tag) {
      return false;
    }

    // Remove tag from all card content before deleting the tag file
    await this.removeTagFromCards(tag);

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
            direction: 1
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
            direction: 0
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
            direction: 0
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
        direction: connection.direction ?? 0
      });
      
      // Add edges for attribute connections
      for (const attributeId of connection.attributeTagIds) {
        edges.push({
          id: `${connection.id}-attr-${attributeId}`,
          source: connection.sourceTagId,
          target: attributeId,
          label: 'has attribute',
          type: 'attribute',
          direction: 0
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
            direction: 0
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
    const extensions = {
      entity: 'entity.txt',
      relationship: 'relate.txt',
      attribute: 'attrib.txt',
      comment: 'comment.txt',
      kv_pair: 'kv.txt',
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

  private async updateCardContent(tag: Tag): Promise<void> {
    try {
      // Update all cards referenced by this tag
      for (const cardRef of tag.references || []) {
        const cardPath = path.join(process.cwd(), 'user_data', 'raw', cardRef);
        
        try {
          const cardContent = await fs.readFile(cardPath, 'utf-8');
          const updatedContent = this.insertTagIntoCard(cardContent, tag);
          await fs.writeFile(cardPath, updatedContent, 'utf-8');
        } catch (error) {
          console.error(`Failed to update card content for ${cardRef}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to update card content:', error);
    }
  }

  private insertTagIntoCard(cardContent: string, tag: Tag): string {
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
    const currentContent = lines.slice(originalContentStart + 1, originalContentEnd).join('\n');
    
    // Extract USER ADDED content if section exists
    let userAddedContent = '';
    if (userAddedStart !== -1 && userAddedEnd !== -1) {
      userAddedContent = lines.slice(userAddedStart + 1, userAddedEnd).join('\n');
    }
    
    // Check if content already has markdown tags for this tag ID in either section
    if (currentContent.includes(`](${tag.id})`) || userAddedContent.includes(`](${tag.id})`)) {
      return cardContent; // Already tagged
    }
    
    // Generate tag markup for the original content
    const taggedOriginalContent = this.generateTagMarkup(currentContent, tag);
    
    // Generate tag markup for user added content if it exists
    const taggedUserAddedContent = userAddedContent ? this.generateTagMarkup(userAddedContent, tag) : '';
    
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
        taggedOriginalContent,
        ...lines.slice(originalContentEnd, userAddedStart + 1),
        taggedUserAddedContent,
        ...lines.slice(userAddedEnd)
      ];
    } else {
      // No USER ADDED section yet
      newLines = [
        ...lines.slice(0, tagIndexStart + 1),
        ...existingTagIndex,
        ...lines.slice(tagIndexEnd, originalContentStart + 1),
        taggedOriginalContent,
        ...lines.slice(originalContentEnd)
      ];
    }

    return newLines.join('\n');
  }
  
  // Append user-added text to a card's USER ADDED section
  // Returns the card's UUID for stable re-selection, or null on failure
  async appendUserText(cardFilename: string, text: string): Promise<string | null> {
    try {
      const cardPath = path.join(USER_DATA_DIR, 'raw', cardFilename);
      const cardContent = await fs.readFile(cardPath, 'utf-8');
      
      // Extract the card's UUID for stable reference
      const uuidMatch = cardContent.match(/^uuid:\s*"([^"]+)"/m);
      const cardUuid = uuidMatch ? uuidMatch[1] : null;
      
      const lines = cardContent.split('\n');
      let userAddedStart = -1;
      let userAddedEnd = -1;
      let originalContentEnd = -1;
      
      // Find section boundaries
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '=== ORIGINAL CONTENT END ===') {
          originalContentEnd = i;
        } else if (line === '=== USER ADDED START ===') {
          userAddedStart = i;
        } else if (line === '=== USER ADDED END ===') {
          userAddedEnd = i;
        }
      }
      
      if (originalContentEnd === -1) {
        console.error('Card does not have expected format');
        return null;
      }
      
      let newLines: string[];
      
      if (userAddedStart !== -1 && userAddedEnd !== -1) {
        // USER ADDED section exists - append to it
        const existingUserContent = lines.slice(userAddedStart + 1, userAddedEnd);
        newLines = [
          ...lines.slice(0, userAddedStart + 1),
          ...existingUserContent,
          text,
          ...lines.slice(userAddedEnd)
        ];
      } else {
        // No USER ADDED section - create it after ORIGINAL CONTENT END
        newLines = [
          ...lines.slice(0, originalContentEnd + 1),
          '',
          '=== USER ADDED START ===',
          text,
          '=== USER ADDED END ===',
          ...lines.slice(originalContentEnd + 1)
        ];
      }
      
      await fs.writeFile(cardPath, newLines.join('\n'), 'utf-8');
      console.log(`Appended user text to card: ${cardFilename}`);
      return cardUuid;
    } catch (error) {
      console.error('Failed to append user text:', error);
      return null;
    }
  }
  
  // Clear user-added text from a card's USER ADDED section
  // Returns the card's UUID for stable re-selection, or null on failure
  async clearUserAddedText(cardFilename: string): Promise<string | null> {
    try {
      const cardPath = path.join(USER_DATA_DIR, 'raw', cardFilename);
      const cardContent = await fs.readFile(cardPath, 'utf-8');
      
      // Extract the card's UUID for stable reference
      const uuidMatch = cardContent.match(/^uuid:\s*"([^"]+)"/m);
      const cardUuid = uuidMatch ? uuidMatch[1] : null;
      
      const lines = cardContent.split('\n');
      let userAddedStart = -1;
      let userAddedEnd = -1;
      
      // Find USER ADDED section boundaries
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '=== USER ADDED START ===') {
          userAddedStart = i;
        } else if (line === '=== USER ADDED END ===') {
          userAddedEnd = i;
        }
      }
      
      if (userAddedStart === -1 || userAddedEnd === -1) {
        // No USER ADDED section, nothing to clear
        return cardUuid;
      }
      
      // Remove the entire USER ADDED section (including delimiters)
      // Also remove the blank line before it if present
      const startIndex = userAddedStart > 0 && lines[userAddedStart - 1].trim() === '' 
        ? userAddedStart - 1 
        : userAddedStart;
      const newLines = [
        ...lines.slice(0, startIndex),
        ...lines.slice(userAddedEnd + 1)
      ];
      
      await fs.writeFile(cardPath, newLines.join('\n'), 'utf-8');
      console.log(`Cleared user-added text from card: ${cardFilename}`);
      return cardUuid;
    } catch (error) {
      console.error('Failed to clear user-added text:', error);
      return null;
    }
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
      
      const uniqueMissing = [...new Set(missingText)];
      const uniqueExtra = [...new Set(extraText)];
      
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
    const tagPattern = /\[(entity|relationship|attribute|comment|kv):([^\]]+)\]\([a-f0-9-]+\)/gi;
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
}

export const orcsService = new OrcsService();
