CREATE TABLE `maintenanceRuns` (
	`id` varchar(64) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`deduplicated` int NOT NULL DEFAULT 0,
	`conflictsResolved` int NOT NULL DEFAULT 0,
	`reindexed` int NOT NULL DEFAULT 0,
	`summary` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `maintenanceRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceSchedules` (
	`id` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cron` varchar(64) NOT NULL DEFAULT '0 0 3 * * *',
	`enabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `maintenanceSchedules_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `threadMessages` (
	`id` varchar(64) NOT NULL,
	`threadId` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`source` varchar(128),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threadMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`mode` enum('hybrid','local','cloud') NOT NULL DEFAULT 'hybrid',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`slug` varchar(128) NOT NULL,
	`name` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_slug_unique` UNIQUE(`slug`)
);
