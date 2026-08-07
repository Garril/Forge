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

CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(50) PRIMARY KEY,
  `setting_value` TEXT,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES
  ('password', ''),
  ('background_path', ''),
  ('lock_bg_path', ''),
  ('bg_mode', 'cover'),
  ('lock_shortcut', 'CommandOrControl+L'),
  ('memo_random_count', '3'),
  ('user_name', ''),
  ('user_avatar', '');

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
