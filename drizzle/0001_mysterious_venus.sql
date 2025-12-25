CREATE TABLE `ai_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('portfolio','position','market','recommendation') NOT NULL,
	`targetTicker` varchar(20),
	`analysis` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dividends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`positionId` int,
	`ticker` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`amount` decimal(18,4) NOT NULL,
	`taxAmount` decimal(18,4) DEFAULT '0',
	`paymentDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dividends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`category` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wkn` varchar(20),
	`ticker` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('Aktie','ETF','Krypto','Anleihe','Fonds') NOT NULL,
	`category` varchar(50),
	`amount` decimal(18,8) NOT NULL,
	`buyPrice` decimal(18,4) NOT NULL,
	`currentPrice` decimal(18,4),
	`status` enum('Kaufen','Halten','Verkaufen') DEFAULT 'Halten',
	`autoUpdate` boolean DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`price` decimal(18,4) NOT NULL,
	`changePercent` decimal(10,4),
	`currency` varchar(10) DEFAULT 'EUR',
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_cache_ticker_unique` UNIQUE(`ticker`)
);
--> statement-breakpoint
CREATE TABLE `savings_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`monthlyAmount` decimal(18,2) NOT NULL,
	`executionDay` int DEFAULT 1,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savings_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`currentPrice` decimal(18,4),
	`targetPrice` decimal(18,4),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `pin` varchar(8);