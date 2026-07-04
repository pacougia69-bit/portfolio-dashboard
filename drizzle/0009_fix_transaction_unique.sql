-- Move UNIQUE constraint from orderNumber to invoiceNumber
-- Reason: DKB Sparplan executions share the same Auftragsnummer across multiple ETFs,
-- but each PDF has a unique Rechnungsnummer (invoiceNumber)
ALTER TABLE `transactions` DROP INDEX `transactions_orderNumber_unique`;
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_invoiceNumber_unique` UNIQUE(`invoiceNumber`);
