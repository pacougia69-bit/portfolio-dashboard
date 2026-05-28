CREATE TABLE `tech_warning_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`overallSignal` enum('gruen','gelb','rot') NOT NULL,
	`indicators` json NOT NULL,
	`summary` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tech_warning_signals_id` PRIMARY KEY(`id`)
);
