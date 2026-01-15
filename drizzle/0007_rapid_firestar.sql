CREATE TABLE `tax_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stockLossPot` decimal(10,2) NOT NULL DEFAULT '0',
	`otherLossPot` decimal(10,2) NOT NULL DEFAULT '0',
	`maxExemptionOrder` decimal(10,2) NOT NULL DEFAULT '1000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tax_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `tax_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`exemptionOrder` decimal(10,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tax_sources_id` PRIMARY KEY(`id`)
);
