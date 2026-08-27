-- NiroLife initial MySQL schema. Run this once in Hostinger phpMyAdmin.
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS practices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(80) NOT NULL,
  city VARCHAR(120) NOT NULL,
  services TEXT NULL,
  phone VARCHAR(40) NULL,
  hours VARCHAR(160) NULL,
  status ENUM('draft','published','suspended') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_practice_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_practice_status (status),
  INDEX idx_practice_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS websites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  practice_id BIGINT UNSIGNED NOT NULL,
  template_slug VARCHAR(80) NOT NULL DEFAULT 'dental-modern',
  slug VARCHAR(180) NOT NULL UNIQUE,
  custom_domain VARCHAR(255) NULL UNIQUE,
  plan ENUM('free','professional','growth') NOT NULL DEFAULT 'free',
  published_at TIMESTAMP NULL,
  CONSTRAINT fk_website_practice FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  plan ENUM('free','professional','growth') NOT NULL DEFAULT 'free',
  status ENUM('trial','active','paused','cancelled') NOT NULL DEFAULT 'trial',
  provider VARCHAR(40) NULL,
  provider_reference VARCHAR(180) NULL,
  renews_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
