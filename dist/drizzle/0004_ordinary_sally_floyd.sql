ALTER TABLE `user_settings` ADD `pinEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `pinHash` varchar(128);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `autoLockMinutes` int DEFAULT 5;