CREATE TABLE `gatewayConfigs` (
	`id` varchar(64) NOT NULL,
	`provider` enum('ollama','vllm','openrouter','openai','anthropic','builtin') NOT NULL,
	`label` varchar(128) NOT NULL,
	`endpoint` text,
	`model` varchar(256) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gatewayConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestionJobs` (
	`id` varchar(64) NOT NULL,
	`source` text NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`documentId` varchar(64),
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestionJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryChunks` (
	`id` varchar(64) NOT NULL,
	`documentId` varchar(64) NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`tokenCount` int NOT NULL,
	`keywords` text,
	`embedding` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memoryChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryDocuments` (
	`id` varchar(64) NOT NULL,
	`title` varchar(512) NOT NULL,
	`sourceUrl` text,
	`sourceType` enum('text','url','file') NOT NULL DEFAULT 'text',
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memoryDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryEdges` (
	`id` varchar(64) NOT NULL,
	`fromId` varchar(64) NOT NULL,
	`toId` varchar(64) NOT NULL,
	`relation` varchar(128) NOT NULL,
	`weight` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memoryEdges_id` PRIMARY KEY(`id`)
);
