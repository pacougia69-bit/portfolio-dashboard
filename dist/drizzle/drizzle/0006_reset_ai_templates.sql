-- Migration: Reset AI Templates Table
-- Drop and recreate table with correct schema

DROP TABLE IF EXISTS `ai_question_templates`;

CREATE TABLE `ai_question_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL,
  `prompt` text NOT NULL,
  `category` varchar(50),
  `icon` varchar(50),
  `isActive` tinyint(1) DEFAULT 1,
  `sortOrder` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
