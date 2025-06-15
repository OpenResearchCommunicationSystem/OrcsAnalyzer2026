import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { insertTagSchema, textSelectionSchema } from "@shared/schema";
import { fileService } from "./services/fileService";
import { orcsService } from "./services/orcsService";
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

  // Graph data
  app.get("/api/graph", async (req, res) => {
    try {
      const graphData = await orcsService.generateGraphData();
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
      
      const results = await storage.searchFiles(query);
      res.json(results);
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

  const httpServer = createServer(app);
  return httpServer;
}
