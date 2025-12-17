import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import fs from "fs/promises";
import { insertTagSchema, insertTagConnectionSchema, textSelectionSchema, insertLinkSchema, insertSnippetSchema, linkSchema, snippetSchema, insertCommentInsertSchema } from "@shared/schema";
import { fileService } from "./services/fileService";
import { orcsService } from "./services/orcsService";
import { indexService } from "./services/indexService";
import { storage } from "./storage";

interface BrokenConnection {
  type: 'missing_entity' | 'missing_relationship' | 'orphaned_reference';
  reason: string;
  filePath?: string;
  details?: string;
}

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

      const { file, cardPath } = await fileService.saveUploadedFile(req.file.originalname, req.file.buffer);
      
      // Update index for both the original file and the ORCS card
      if (file.path) {
        await indexService.reindexFile(file.path);
      }
      if (cardPath) {
        await indexService.reindexFile(cardPath);
      }
      
      // Recalculate stats after indexing
      await indexService.recalculateStats();
      
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
      // Get indexed files for cascade delete (includes cardUuid and sourceFile info)
      const index = await indexService.getIndex();
      const indexedFiles = index?.files || [];
      
      // Perform cascade delete (deletes both original and card file as a pair)
      const result = await fileService.deleteDocumentCascade(req.params.id, indexedFiles);
      
      if (!result.success) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Remove deleted files from index
      for (const deletedPath of result.deletedPaths) {
        await indexService.removeFromIndex(deletedPath);
      }
      
      // Clean up tag references to the deleted card
      let tagsCleaned = 0;
      if (result.cardFilename) {
        tagsCleaned = await indexService.cleanupTagReferences(result.cardFilename);
      }
      
      // Recalculate stats after all changes
      await indexService.recalculateStats();
      
      console.log(`[DELETE] Cascade deleted ${result.deletedPaths.length} files, cleaned ${tagsCleaned} tag references`);
      
      res.json({ 
        success: true,
        deletedFiles: result.deletedPaths.length,
        tagsCleaned,
      });
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

  // Update card metadata fields only (preserves ORIGINAL CONTENT)
  app.patch("/api/files/:id/card-metadata", async (req, res) => {
    try {
      const fileId = req.params.id;
      const { source_reference, classification, handling, analyst } = req.body;
      
      console.log("Card metadata update request:", { fileId, source_reference, classification, handling, analyst });
      
      const files = await fileService.getFiles();
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        console.error("File not found:", fileId);
        return res.status(404).json({ error: "File not found" });
      }
      
      // Only allow updating card files
      if (!file.name.endsWith('.card.txt')) {
        return res.status(400).json({ error: "Can only update metadata for card files" });
      }
      
      await fileService.updateCardMetadata(file.name, {
        source_reference,
        classification,
        handling,
        analyst
      });
      
      console.log("Card metadata saved successfully for:", file.name);
      res.json({ success: true });
    } catch (error) {
      console.error("Card metadata update error:", error);
      res.status(500).json({ error: "Failed to update card metadata", details: error instanceof Error ? error.message : String(error) });
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
      
      // Update index for modified file
      await indexService.reindexFile(file.path);
      
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
      
      // Update index with new tag
      const tagFilePath = orcsService.getTagFilePath(tag);
      await indexService.reindexTag(tag.id, tagFilePath);
      
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
      
      // Update index with modified tag
      const tagFilePath = orcsService.getTagFilePath(tag);
      await indexService.reindexTag(tag.id, tagFilePath);
      
      res.json(tag);
    } catch (error) {
      console.error("Tag update error:", error);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const dryRun = req.query.dryRun === 'true';
      
      if (dryRun) {
        // Preview mode - show what would be affected without deleting
        const preview = await orcsService.previewTagDeletion(req.params.id);
        if (!preview.tag) {
          return res.status(404).json({ error: "Tag not found" });
        }
        return res.json({
          dryRun: true,
          tag: preview.tag,
          affectedCards: preview.affectedCards,
          affectedLinks: preview.affectedLinks,
          affectedConnections: preview.affectedConnections,
          tagFilePath: preview.tagFilePath,
          message: `Deleting this tag will affect ${preview.affectedCards.length} card(s), ${preview.affectedLinks} link(s), and ${preview.affectedConnections} connection(s).`
        });
      }
      
      const success = await orcsService.deleteTag(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Tag not found" });
      }
      
      // Remove deleted tag from index
      await indexService.removeTagFromIndex(req.params.id);
      
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
      
      // Update index: update merged master tag, remove merged tags
      const masterTagFilePath = orcsService.getTagFilePath(result);
      await indexService.reindexTag(masterTagId, masterTagFilePath);
      for (const mergedTagId of tagIdsToMerge) {
        await indexService.removeTagFromIndex(mergedTagId);
      }
      
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
      const gc = req.query.gc === 'true'; // Garbage collection mode
      const dryRun = req.query.dryRun === 'true';
      
      const index = await indexService.buildFullIndex() as any;
      
      // Garbage collection: clean up orphaned references
      if (gc) {
        const orphans = (index.brokenConnections || []).filter((b: BrokenConnection) => b.reason === 'orphaned_reference');
        
        if (dryRun) {
          return res.json({
            message: 'Garbage collection dry run',
            dryRun: true,
            orphansToClean: orphans.length,
            orphanDetails: orphans.map((o: BrokenConnection) => o.details),
            stats: index.stats
          });
        }
        
        // Actually clean orphaned tag references
        let cleanedCount = 0;
        for (const orphan of orphans) {
          try {
            // Parse the orphan to get tag info
            const tagPath = orphan.filePath;
            if (tagPath) {
              const content = await fs.readFile(tagPath, 'utf-8');
              // Extract the orphaned file reference from details
              const refMatch = orphan.details?.match(/references file "([^"]+)"/);
              if (refMatch) {
                const orphanedRef = refMatch[1];
                // Remove the orphaned reference from CARD_REFERENCES
                const updatedContent = content.replace(
                  new RegExp(`CARD_REFERENCES:.*${orphanedRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,\\n]?`, 'g'),
                  (match: string) => match.replace(orphanedRef, '').replace(/,,/g, ',').replace(/,$/, '').replace(/: ,/g, ':')
                );
                if (updatedContent !== content) {
                  await fs.writeFile(tagPath, updatedContent, 'utf-8');
                  cleanedCount++;
                  console.log(`[GC] Cleaned orphaned reference from: ${tagPath}`);
                }
              }
            }
          } catch (err) {
            console.error(`[GC] Failed to clean orphan:`, err);
          }
        }
        
        // Rebuild index after cleanup
        const newIndex = await indexService.buildFullIndex();
        
        return res.json({
          message: `Garbage collection completed. Cleaned ${cleanedCount} orphaned references.`,
          cleaned: cleanedCount,
          stats: newIndex.stats
        });
      }
      
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

  // =====================================================================
  // LINK API ROUTES
  // =====================================================================

  app.get('/api/cards/:cardId/links', async (req, res) => {
    try {
      const links = await orcsService.getLinksFromCard(req.params.cardId);
      res.json(links);
    } catch (error) {
      console.error('Failed to get links:', error);
      res.status(500).json({ error: 'Failed to get links' });
    }
  });

  app.post('/api/cards/:cardId/links', async (req, res) => {
    try {
      const createLinkSchema = insertLinkSchema.omit({ sourceCardId: true });
      const linkData = createLinkSchema.parse(req.body);
      const link = await orcsService.createLink(linkData, req.params.cardId);
      res.status(201).json(link);
    } catch (error) {
      console.error('Failed to create link:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid link data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create link' });
      }
    }
  });

  app.patch('/api/cards/:cardId/links/:linkId', async (req, res) => {
    try {
      const updateSchema = linkSchema.partial().omit({ id: true, created: true, sourceCardId: true });
      const validatedUpdates = updateSchema.parse(req.body);
      const link = await orcsService.updateLink(req.params.cardId, req.params.linkId, validatedUpdates);
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }
      res.json(link);
    } catch (error) {
      console.error('Failed to update link:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid link data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update link' });
      }
    }
  });

  app.delete('/api/cards/:cardId/links/:linkId', async (req, res) => {
    try {
      const deleted = await orcsService.deleteLink(req.params.cardId, req.params.linkId);
      if (!deleted) {
        return res.status(404).json({ error: 'Link not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete link:', error);
      res.status(500).json({ error: 'Failed to delete link' });
    }
  });

  // =====================================================================
  // SNIPPET API ROUTES
  // =====================================================================

  app.get('/api/cards/:cardId/snippets', async (req, res) => {
    try {
      const snippets = await orcsService.getSnippetsFromCard(req.params.cardId);
      res.json(snippets);
    } catch (error) {
      console.error('Failed to get snippets:', error);
      res.status(500).json({ error: 'Failed to get snippets' });
    }
  });

  app.post('/api/cards/:cardId/snippets', async (req, res) => {
    try {
      const snippetData = insertSnippetSchema.parse({
        ...req.body,
        cardId: req.params.cardId,
      });
      const snippet = await orcsService.createSnippet(snippetData);
      res.status(201).json(snippet);
    } catch (error) {
      console.error('Failed to create snippet:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid snippet data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create snippet' });
      }
    }
  });

  app.patch('/api/cards/:cardId/snippets/:snippetId', async (req, res) => {
    try {
      const updateSchema = snippetSchema.partial().omit({ id: true, created: true, cardId: true });
      const validatedUpdates = updateSchema.parse(req.body);
      const snippet = await orcsService.updateSnippet(req.params.cardId, req.params.snippetId, validatedUpdates);
      if (!snippet) {
        return res.status(404).json({ error: 'Snippet not found' });
      }
      res.json(snippet);
    } catch (error) {
      console.error('Failed to update snippet:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid snippet data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update snippet' });
      }
    }
  });

  app.delete('/api/cards/:cardId/snippets/:snippetId', async (req, res) => {
    try {
      const deleted = await orcsService.deleteSnippet(req.params.cardId, req.params.snippetId);
      if (!deleted) {
        return res.status(404).json({ error: 'Snippet not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete snippet:', error);
      res.status(500).json({ error: 'Failed to delete snippet' });
    }
  });

  // =====================================================================
  // COMMENT INSERT API (Inline track-changes style comments)
  // =====================================================================

  app.get('/api/cards/:cardId/comments', async (req, res) => {
    try {
      const comments = await orcsService.getCommentsFromCard(req.params.cardId);
      res.json(comments);
    } catch (error) {
      console.error('Failed to get comments:', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  });

  app.post('/api/cards/:cardId/comments', async (req, res) => {
    try {
      // Validate request body with Zod schema
      const commentData = insertCommentInsertSchema.parse({
        ...req.body,
        cardId: req.params.cardId,
      });

      const comment = await orcsService.addComment(req.params.cardId, {
        text: commentData.text,
        insertOffset: commentData.insertOffset,
        analyst: commentData.analyst,
        classification: commentData.classification,
      });

      if (!comment) {
        return res.status(404).json({ error: 'Card not found' });
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error('Failed to create comment:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid comment data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create comment' });
      }
    }
  });

  app.delete('/api/cards/:cardId/comments/:commentId', async (req, res) => {
    try {
      const deleted = await orcsService.deleteComment(req.params.cardId, req.params.commentId);
      if (!deleted) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  // =====================================================================
  // BULLET GENERATION API
  // =====================================================================

  app.get('/api/cards/:cardId/bullets', async (req, res) => {
    try {
      const bullets = await orcsService.generateBulletsFromCard(req.params.cardId);
      res.json(bullets);
    } catch (error) {
      console.error('Failed to generate bullets:', error);
      res.status(500).json({ error: 'Failed to generate bullets' });
    }
  });

  // =====================================================================
  // DOSSIER API
  // =====================================================================

  app.get('/api/entities/:entityId/dossier', async (req, res) => {
    try {
      const dossier = await orcsService.buildDossier(req.params.entityId);
      if (!dossier.entity) {
        return res.status(404).json({ error: 'Entity not found' });
      }
      res.json(dossier);
    } catch (error) {
      console.error('Failed to build dossier:', error);
      res.status(500).json({ error: 'Failed to build dossier' });
    }
  });

  // =====================================================================
  // SYSTEM RESET API
  // =====================================================================

  app.post('/api/system/reset-tags', async (req, res) => {
    try {
      const result = await orcsService.resetAllTags();
      // Rebuild the index after reset
      await indexService.buildFullIndex();
      res.json(result);
    } catch (error) {
      console.error('Failed to reset tags:', error);
      res.status(500).json({ error: 'Failed to reset tags' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
