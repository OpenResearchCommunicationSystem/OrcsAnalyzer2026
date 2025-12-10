import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { insertTagSchema, insertTagConnectionSchema, textSelectionSchema } from "@shared/schema";
import { fileService } from "./services/fileService";
import { orcsService } from "./services/orcsService";
import { indexService } from "./services/indexService";
import { storage } from "./storage";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // File operations
  app.get("/api/files", async (req, res) => {
    try {
      const files = await fileService.getFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const allowedTypes = ['.txt', '.csv'];
      const fileExtension = req.file.originalname.toLowerCase().slice(-4);
      
      if (!allowedTypes.some(type => req.file!.originalname.toLowerCase().endsWith(type))) {
        return res.status(400).json({ error: "Only .txt and .csv files are allowed" });
      }

      const file = await fileService.saveUploadedFile(req.file.originalname, req.file.buffer);
      res.json(file);
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.get("/api/files/:id/content", async (req, res) => {
    try {
      const fileId = req.params.id;
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const content = await fileService.getFileContent(file.path);
      res.json({ content });
    } catch (error) {
      res.status(404).json({ error: "File not found" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const success = await fileService.deleteFile(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("File deletion error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Metadata operations
  app.get("/api/files/:id/metadata", async (req, res) => {
    try {
      const fileId = req.params.id;
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const metadata = await fileService.getMetadataForFile(file.name);
      res.json({ metadata: metadata || "" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  app.put("/api/files/:id/metadata", async (req, res) => {
    try {
      const fileId = req.params.id;
      const { metadata } = req.body;
      
      console.log("Metadata update request:", { fileId, metadataLength: metadata?.length });
      
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        console.error("File not found:", fileId);
        return res.status(404).json({ error: "File not found" });
      }
      
      if (!metadata || typeof metadata !== 'string') {
        console.error("Invalid metadata:", metadata);
        return res.status(400).json({ error: "Invalid metadata content" });
      }
      
      await fileService.updateMetadataFile(file.name, metadata);
      console.log("Metadata saved successfully for:", file.name);
      res.json({ success: true });
    } catch (error) {
      console.error("Metadata update error:", error);
      res.status(500).json({ error: "Failed to update metadata", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Append user-added text to a card file
  app.post("/api/files/:id/append-text", async (req, res) => {
    try {
      const fileId = req.params.id;
      const { text } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Only allow appending to card files
      if (!file.name.endsWith('.card.txt')) {
        return res.status(400).json({ error: "Can only append text to card files" });
      }
      
      const cardUuid = await orcsService.appendUserText(file.name, text.trim());
      if (!cardUuid) {
        return res.status(500).json({ error: "Failed to append text to card" });
      }
      
      res.json({ success: true, cardUuid });
    } catch (error) {
      console.error("Append text error:", error);
      res.status(500).json({ error: "Failed to append text" });
    }
  });

  // Clear user-added text from a card file
  app.delete("/api/files/:id/user-added", async (req, res) => {
    try {
      const fileId = req.params.id;
      
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Only allow clearing from card files
      if (!file.name.endsWith('.card.txt')) {
        return res.status(400).json({ error: "Can only clear user-added text from card files" });
      }
      
      const cardUuid = await orcsService.clearUserAddedText(file.name);
      if (cardUuid === null) {
        return res.status(500).json({ error: "Failed to clear user-added text" });
      }
      
      res.json({ success: true, cardUuid });
    } catch (error) {
      console.error("Clear user-added text error:", error);
      res.status(500).json({ error: "Failed to clear user-added text" });
    }
  });

  // Verify card content integrity against original source file
  app.get("/api/files/:id/verify-content", async (req, res) => {
    try {
      const fileId = req.params.id;
      
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Only verify card files
      if (!file.name.endsWith('.card.txt')) {
        return res.status(400).json({ error: "Can only verify card files" });
      }
      
      const result = await orcsService.verifyContentIntegrity(file.name);
      res.json(result);
    } catch (error) {
      console.error("Verify content error:", error);
      res.status(500).json({ error: "Failed to verify content integrity" });
    }
  });

  // Restore original content from source file
  app.post("/api/files/:id/restore-content", async (req, res) => {
    try {
      const fileId = req.params.id;
      
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Only restore card files
      if (!file.name.endsWith('.card.txt')) {
        return res.status(400).json({ error: "Can only restore content in card files" });
      }
      
      const result = await orcsService.restoreOriginalContent(file.name);
      if (!result.success) {
        return res.status(500).json({ error: result.message });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Restore content error:", error);
      res.status(500).json({ error: "Failed to restore content" });
    }
  });

  // Tag operations
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await orcsService.getTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.get("/api/tags/type/:type", async (req, res) => {
    try {
      const tags = await orcsService.getTagsByType(req.params.type as any);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags by type" });
    }
  });

  app.get("/api/tags/:id", async (req, res) => {
    try {
      const tag = await orcsService.getTag(req.params.id);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tag" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const tagData = insertTagSchema.parse(req.body);
      const tag = await orcsService.createTag(tagData);
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid tag data", details: error.errors });
      }
      console.error("Tag creation error:", error);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.put("/api/tags/:id", async (req, res) => {
    try {
      const updates = req.body;
      const tag = await orcsService.updateTag(req.params.id, updates);
      res.json(tag);
    } catch (error) {
      console.error("Tag update error:", error);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const success = await orcsService.deleteTag(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Tag merge operation
  app.post("/api/tags/:id/merge", async (req, res) => {
    try {
      const masterTagId = req.params.id;
      const { tagIdsToMerge } = req.body;
      
      if (!Array.isArray(tagIdsToMerge) || tagIdsToMerge.length === 0) {
        return res.status(400).json({ error: "Invalid tagIdsToMerge array" });
      }

      const result = await orcsService.mergeTags(masterTagId, tagIdsToMerge);
      res.json(result);
    } catch (error) {
      console.error("Tag merge error:", error);
      res.status(500).json({ error: "Failed to merge tags" });
    }
  });

  // Tag Connection operations
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getTagConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tag connections" });
    }
  });

  app.get("/api/connections/:id", async (req, res) => {
    try {
      const connection = await storage.getTagConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tag connection" });
    }
  });

  app.get("/api/tags/:id/connections", async (req, res) => {
    try {
      const connections = await storage.getConnectionsForTag(req.params.id);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch connections for tag" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const { customLabel, ...connectionData } = req.body;
      
      let relationshipTagId = connectionData.relationshipTagId;
      
      // If custom label provided, create a relationship tag first
      if (customLabel && !relationshipTagId) {
        const labelText = customLabel.trim() || 'manual link';
        const relationshipTag = await orcsService.createTag({
          type: 'relationship',
          name: labelText,
          references: [],
          aliases: [],
          keyValuePairs: {},
          description: `Manual connection: ${labelText}`
        });
        relationshipTagId = relationshipTag.id;
      }
      
      // Build connection data with required fields
      const finalConnectionData = {
        sourceTagId: connectionData.sourceTagId,
        targetTagId: connectionData.targetTagId,
        relationshipTagId,
        attributeTagIds: connectionData.attributeTagIds || [],
        connectionType: connectionData.connectionType || 'entity_relationship',
        direction: connectionData.direction ?? 0,
        strength: connectionData.strength ?? 1,
        notes: connectionData.notes
      };
      
      const validatedData = insertTagConnectionSchema.parse(finalConnectionData);
      const connection = await storage.createTagConnection(validatedData);
      res.status(201).json(connection);
    } catch (error) {
      console.error("Connection creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid connection data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create tag connection" });
    }
  });

  app.put("/api/connections/:id", async (req, res) => {
    try {
      const connection = await storage.updateTagConnection(req.params.id, req.body);
      res.json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tag connection" });
    }
  });

  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const success = await storage.deleteTagConnection(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tag connection" });
    }
  });

  // Graph data
  app.get("/api/graph", async (req, res) => {
    try {
      const graphData = await orcsService.generateGraphDataWithConnections();
      res.json(graphData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate graph data" });
    }
  });

  // Statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const files = await fileService.getFiles();
      const tags = await orcsService.getTags();
      
      const tagCounts = tags.reduce((acc, tag) => {
        acc[tag.type] = (acc[tag.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalFiles: files.length,
        totalTags: tags.length,
        tagCounts,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Search files
  app.get('/api/search/files', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      
      // Use file service to get files and search through them
      const files = await fileService.getFiles();
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      
      const results = [];
      for (const file of files) {
        let score = 0;
        
        // Search in filename (higher weight)
        if (file.name.toLowerCase().includes(query.toLowerCase())) {
          score += 10;
        }
        
        try {
          // Search in content
          const content = await fileService.getFileContent(file.path);
          const contentLower = content.toLowerCase();
          
          for (const term of searchTerms) {
            if (contentLower.includes(term)) {
              score += contentLower.split(term).length - 1; // Count occurrences
            }
          }
          

        } catch (error) {
          console.warn(`Could not read content for ${file.name}:`, error);
        }
        
        if (score > 0) {
          results.push({ file, score });
        }
      }
      
      // Sort by relevance and return files
      const sortedFiles = results
        .sort((a, b) => b.score - a.score)
        .map(result => result.file);
      
      res.json(sortedFiles);
    } catch (error) {
      console.error('Search failed:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Search content with context
  app.get('/api/search/content', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      
      const results = await storage.searchContent(query);
      res.json(results);
    } catch (error) {
      console.error('Content search failed:', error);
      res.status(500).json({ error: 'Content search failed' });
    }
  });

  // Rebuild search index
  app.post('/api/index/rebuild', async (req, res) => {
    try {
      await storage.buildIndex();
      res.json({ message: 'Index rebuilt successfully' });
    } catch (error) {
      console.error('Index rebuild failed:', error);
      res.status(500).json({ error: 'Index rebuild failed' });
    }
  });

  // Master Index API routes
  app.get('/api/system/index', async (req, res) => {
    try {
      const index = await indexService.getIndex();
      res.json(index);
    } catch (error) {
      console.error('Failed to get index:', error);
      res.status(500).json({ error: 'Failed to get index' });
    }
  });

  app.post('/api/system/reindex', async (req, res) => {
    try {
      const index = await indexService.buildFullIndex();
      res.json({ 
        message: 'System reindexed successfully',
        stats: index.stats 
      });
    } catch (error) {
      console.error('Reindex failed:', error);
      res.status(500).json({ error: 'Reindex failed' });
    }
  });

  app.get('/api/system/broken-connections', async (req, res) => {
    try {
      const brokenConnections = await indexService.validateConnections();
      res.json(brokenConnections);
    } catch (error) {
      console.error('Failed to validate connections:', error);
      res.status(500).json({ error: 'Failed to validate connections' });
    }
  });

  app.get('/api/system/stats', async (req, res) => {
    try {
      const index = await indexService.getIndex();
      res.json(index.stats);
    } catch (error) {
      console.error('Failed to get stats:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
