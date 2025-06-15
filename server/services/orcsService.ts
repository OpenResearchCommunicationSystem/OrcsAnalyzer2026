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
