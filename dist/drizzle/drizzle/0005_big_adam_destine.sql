CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` timestamp NOT NULL,
	`type` enum('Kauf','Verkauf','Sparplan') NOT NULL,
	`isin` varchar(20) NOT NULL,
	`wkn` varchar(20),
	`name` varchar(255) NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`price` decimal(18,4) NOT NULL,
	`fees` decimal(18,4) DEFAULT '0',
	`totalAmount` decimal(18,4) NOT NULL,
	`orderNumber` varchar(100) NOT NULL,
	`invoiceNumber` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_orderNumber_unique` UNIQUE(`orderNumber`)
);
