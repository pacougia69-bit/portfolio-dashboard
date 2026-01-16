-- Create tax_allowances table
CREATE TABLE IF NOT EXISTS `tax_allowances` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `year` int NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT '0',
  `used` decimal(10,2) NOT NULL DEFAULT '0',
  `broker` varchar(100),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create loss_carryforwards table
CREATE TABLE IF NOT EXISTS `loss_carryforwards` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `year` int NOT NULL,
  `category` enum('general','stocks','other') NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT '0',
  `broker` varchar(100),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
