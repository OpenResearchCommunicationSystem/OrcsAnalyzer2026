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
      const cardContent = await fs.readFile(cardPath, 'utf-8');
      
      // Parse the ORCS card to extract current tags
      const tagMatch = cardContent.match(/TAGS: (.+)/);
      const existingTags = tagMatch ? tagMatch[1].split(',').map(t => t.trim()).filter(t => t) : [];
      
      // Create tag reference for the ORCS card
      const tagReference = `${tag.type}:${tag.name} (${tag.reference})`;
      
      // Add the new tag if it's not already present
      if (!existingTags.includes(tagReference)) {
        existingTags.push(tagReference);
        
        // Update the ORCS card content
        const updatedContent = cardContent.replace(
          /TAGS: .*/,
          `TAGS: ${existingTags.join(', ')}`
        );
        
        await fs.writeFile(cardPath, updatedContent, 'utf-8');
      }
    } catch (error) {
      console.warn(`Could not update ORCS card ${cardFilename}:`, error);
    }
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
