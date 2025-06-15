import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Tag, InsertTag, TagType, GraphData, GraphNode, GraphEdge } from '@shared/schema';

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
    
    // If this tag references an original file, add it to the corresponding ORCS card
    await this.addTagToOrcsCard(tag);
    
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
    
    for (const [type, dir] of Object.entries(TAG_DIRECTORIES)) {
      try {
        const files = await fs.readdir(dir);
        for (const filename of files) {
          if (filename === '.gitkeep') continue;
          const filepath = path.join(dir, filename);
          const content = await fs.readFile(filepath, 'utf-8');
          const tag = this.parseTagFromOrcsFile(content);
          if (tag) {
            tags.push(tag);
          }
        }
      } catch (error) {
        // Directory might not exist or be empty
      }
    }
    
    return tags;
  }

  async getTagsByType(type: TagType): Promise<Tag[]> {
    const tags: Tag[] = [];
    const dir = TAG_DIRECTORIES[type];
    
    try {
      const files = await fs.readdir(dir);
      for (const filename of files) {
        if (filename === '.gitkeep') continue;
        const filepath = path.join(dir, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        const tag = this.parseTagFromOrcsFile(content);
        if (tag) {
          tags.push(tag);
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

    const dir = TAG_DIRECTORIES[tag.type];
    const filename = `${tag.name}_${tagId}.orcs`;
    const filepath = path.join(dir, filename);
    
    try {
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async addTagToOrcsCard(tag: Tag): Promise<void> {
    // Extract filename from the tag reference (format: filename@offset or filename[row,col])
    const referenceMatch = tag.reference.match(/^([^@\[]+)/);
    if (!referenceMatch) return;
    
    const originalFilename = referenceMatch[1];
    
    // Find the corresponding ORCS card
    const cardFilename = `${path.parse(originalFilename).name}_ORCS_CARD.txt`;
    const cardPath = path.join(path.join(process.cwd(), 'user_data', 'cards'), cardFilename);
    
    try {
      // Read the existing ORCS card
      let cardContent = await fs.readFile(cardPath, 'utf-8');
      
      // Extract UUID from card for index file
      const uuidMatch = cardContent.match(/UUID: ([^\n]+)/);
      const cardUuid = uuidMatch ? uuidMatch[1] : '';
      
      // Format tag entry based on type
      let tagEntry = '';
      if (tag.type === 'entity') {
        tagEntry = `uuid:${tag.id} ${tag.description || 'entity'}:${tag.name}@${tag.reference.split('@')[1] || '0-0'} [${tag.aliases.join(', ')}]`;
      } else if (tag.type === 'relationship') {
        tagEntry = `${tag.name}(${tag.id})`;
      } else if (tag.type === 'attribute') {
        tagEntry = `uuid:${tag.id} attribute:${tag.name}@${tag.reference.split('@')[1] || '0-0'}`;
      } else if (tag.type === 'comment') {
        tagEntry = `uuid:${tag.id} comment:${tag.name}@${tag.reference.split('@')[1] || '0-0'} [${tag.aliases.join(', ')}]`;
      }
      
      // Add to appropriate section in ORCS card
      const sectionName = tag.type.toUpperCase() + 'S:';
      const sectionRegex = new RegExp(`(${sectionName}\\n)(.*?)(\\n\\n|\\n===|$)`, 's');
      
      if (cardContent.includes(sectionName)) {
        // Section exists, add to it
        cardContent = cardContent.replace(sectionRegex, (match, header, content, footer) => {
          const existingEntries = content.trim().split('\n').filter(line => line.trim());
          if (!existingEntries.includes(tagEntry)) {
            existingEntries.push(tagEntry);
          }
          return header + existingEntries.join('\n') + '\n' + footer;
        });
      } else {
        // Section doesn't exist, add it before the END markers
        const insertPoint = cardContent.indexOf('=== END HANDLING:');
        if (insertPoint > -1) {
          const before = cardContent.substring(0, insertPoint);
          const after = cardContent.substring(insertPoint);
          cardContent = before + `${sectionName}\n${tagEntry}\n\n` + after;
        }
      }
      
      // Update the ORCS card
      await fs.writeFile(cardPath, cardContent, 'utf-8');
      
      // Create index file in appropriate tag folder
      await this.createTagIndexFile(tag, cardUuid, cardFilename);
      
    } catch (error) {
      console.warn(`Could not update ORCS card ${cardFilename}:`, error);
    }
  }

  private async createTagIndexFile(tag: Tag, sourceCardUuid: string, cardFilename: string): Promise<void> {
    const tagDir = TAG_DIRECTORIES[tag.type];
    const indexFilename = `${tag.name}_${tag.id}.orcs`;
    const indexPath = path.join(tagDir, indexFilename);
    
    const indexContent = [
      `=== TAG TYPE: ${tag.type.charAt(0).toUpperCase() + tag.type.slice(1)} ===`,
      `UUID: ${tag.id}`,
      tag.type === 'entity' ? `ENTITY_TYPE: ${tag.description || 'unknown'}` : '',
      `LABEL: ${tag.name}`,
      tag.aliases.length > 0 ? `ALIAS: ${tag.aliases.join(', ')}` : '',
      `INDEX: ${tag.reference}`,
      `SOURCE_CARD_UUID: ${sourceCardUuid}`,
      '',
      'CLASSIFICATION: Proprietary Information',
      'CITATION: TechWatch Intelligence Brief, Q1 2025, Internal Analysis',
      '',
      tag.keyValuePairs && Object.keys(tag.keyValuePairs).length > 0 ? 'KEYVALUE_PAIRS:' : '',
      ...Object.entries(tag.keyValuePairs || {}).map(([k, v]) => `  ${k}: ${v}`),
      ''
    ].filter(line => line !== '').join('\n');
    
    await fs.writeFile(indexPath, indexContent, 'utf-8');
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
      // Parse relationship format: "entityA RELATION entityB"
      const relationshipText = relationship.description || relationship.name;
      const match = relationshipText.match(/(\w+)\s+(\w+)\s+(\w+)/);
      
      if (match) {
        const [, sourceEntity, relationLabel, targetEntity] = match;
        const sourceNode = nodes.find(node => node.label.toLowerCase() === sourceEntity.toLowerCase());
        const targetNode = nodes.find(node => node.label.toLowerCase() === targetEntity.toLowerCase());
        
        if (sourceNode && targetNode) {
          edges.push({
            id: relationship.id,
            source: sourceNode.id,
            target: targetNode.id,
            label: relationLabel,
            type: 'relationship',
          });
        }
      }
    });

    return { nodes, edges };
  }

  private async saveTagToFile(tag: Tag): Promise<void> {
    const dir = TAG_DIRECTORIES[tag.type];
    const filename = `${tag.name}_${tag.id}.orcs`;
    const filepath = path.join(dir, filename);
    
    const orcsContent = this.formatTagAsOrcs(tag);
    await fs.writeFile(filepath, orcsContent, 'utf-8');
  }

  private formatTagAsOrcs(tag: Tag): string {
    const lines = [
      '=== ORCS TAG FILE ===',
      `UUID: ${tag.id}`,
      `TYPE: ${tag.type}`,
      `NAME: ${tag.name}`,
      `REFERENCE: ${tag.reference}`,
      `CREATED: ${tag.created}`,
      `MODIFIED: ${tag.modified}`,
      '',
      'ALIASES:',
      ...tag.aliases.map(alias => `  - ${alias}`),
      '',
      'KEY_VALUE_PAIRS:',
      ...Object.entries(tag.keyValuePairs).map(([k, v]) => `${k}: ${v}`),
      '',
    ];

    if (tag.description) {
      lines.push('DESCRIPTION:');
      lines.push(tag.description);
      lines.push('');
    }

    lines.push('=== END ORCS TAG FILE ===');
    
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
      } else if (trimmed.startsWith('TYPE:')) {
        tag.type = trimmed.substring(5).trim() as TagType;
      } else if (trimmed.startsWith('NAME:')) {
        tag.name = trimmed.substring(5).trim();
      } else if (trimmed.startsWith('REFERENCE:')) {
        tag.reference = trimmed.substring(10).trim();
      } else if (trimmed.startsWith('CREATED:')) {
        tag.created = trimmed.substring(8).trim();
      } else if (trimmed.startsWith('MODIFIED:')) {
        tag.modified = trimmed.substring(9).trim();
      } else if (trimmed === 'ALIASES:') {
        currentSection = 'aliases';
      } else if (trimmed === 'KEY_VALUE_PAIRS:') {
        currentSection = 'kvp';
      } else if (trimmed === 'DESCRIPTION:') {
        currentSection = 'description';
      } else if (currentSection === 'aliases' && trimmed.startsWith('- ')) {
        tag.aliases!.push(trimmed.substring(2));
      } else if (currentSection === 'kvp' && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        tag.keyValuePairs![key.trim()] = valueParts.join(':').trim();
      } else if (currentSection === 'description' && trimmed && !trimmed.startsWith('===')) {
        tag.description = (tag.description || '') + trimmed + '\n';
      }
    }

    // Validate required fields
    if (tag.id && tag.type && tag.name && tag.reference && tag.created && tag.modified) {
      return tag as Tag;
    }
    
    return null;
  }
}

export const orcsService = new OrcsService();
