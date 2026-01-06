-- Migration: Create Media Insights Table
-- Stores uploaded financial media (screenshots, PDFs) with AI analysis

CREATE TABLE IF NOT EXISTS `media_insights` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `assetId` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `summary` text,
  `source` varchar(100),
  `imageUrl` varchar(500),
  `pdfUrl` varchar(500),
  `analysisData` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  KEY `idx_assetId` (`assetId`),
  CONSTRAINT `fk_media_insights_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
