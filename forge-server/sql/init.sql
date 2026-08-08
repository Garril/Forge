-- Forge public project database schema
-- This file contains structure only and no personal data or secrets.

CREATE TABLE IF NOT EXISTS `habits` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(255),
  `description` TEXT,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `habit_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `habit_id` VARCHAR(36) NOT NULL,
  `check_date` DATE NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_habit_date` (`habit_id`, `check_date`),
  FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `processes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `start_time` DATETIME,
  `deadline` DATETIME,
  `status` TINYINT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` VARCHAR(36) PRIMARY KEY,
  `process_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `is_completed` BOOLEAN DEFAULT FALSE,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`process_id`) REFERENCES `processes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(50) PRIMARY KEY,
  `setting_value` TEXT,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
  ('password', '123456'),
  ('background_path', ''),
  ('lock_bg_path', ''),
  ('bg_mode', 'cover'),
  ('lock_shortcut', 'CommandOrControl+L'),
  ('memo_random_count', '3'),
  ('user_name', ''),
  ('user_avatar', '')
ON DUPLICATE KEY UPDATE
  setting_value = IF(setting_value IS NULL OR setting_value = '', VALUES(setting_value), setting_value);

CREATE TABLE IF NOT EXISTS `memos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL DEFAULT '',
  `content` TEXT NOT NULL,
  `attachments` JSON COMMENT '附件列表（JSON格式）',
  `display_type` ENUM('permanent', 'random') DEFAULT 'permanent',
  `random_count` INT DEFAULT 3,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_display_type` (`display_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `schedule_blocks` (
  `id` VARCHAR(36) PRIMARY KEY,
  `block_date` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_block_date` (`block_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `event_date` DATE NOT NULL,
  `content` TEXT NOT NULL,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_event_date` (`event_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `schedule_presets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `items` JSON NOT NULL,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `schedule_blocks` (
  `id` VARCHAR(36) PRIMARY KEY,
  `block_date` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_block_date` (`block_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `diet_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `record_date` VARCHAR(20) NOT NULL,
  `meal_time` VARCHAR(20) NOT NULL,
  `content` TEXT,
  `category` VARCHAR(50),
  `shop_name` VARCHAR(100),
  `review` VARCHAR(255),
  `cost` DECIMAL(10, 2) DEFAULT 0,
  `is_favorite` INT DEFAULT 0,
  UNIQUE KEY `unique_date_meal` (`record_date`, `meal_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
