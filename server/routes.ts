import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { insertTagSchema, textSelectionSchema } from "@shared/schema";
import { fileService } from "./services/fileService";
import { orcsService } from "./services/orcsService";

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

  app.get("/api/files/:path/content", async (req, res) => {
    try {
      const decodedPath = decodeURIComponent(req.params.path);
      const content = await fileService.getFileContent(decodedPath);
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

  const httpServer = createServer(app);
  return httpServer;
}
