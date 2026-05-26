-- ==========================================
-- SKILLQUEST DATABASE INITIALIZATION SCHEMA
-- ==========================================

CREATE DATABASE IF NOT EXISTS skillquest;
USE skillquest;

-- 1. Student Table (Core student accounts and states)
CREATE TABLE IF NOT EXISTS student (
  student_ID                  VARCHAR(10) NOT NULL,
  name                        VARCHAR(255) NOT NULL,
  email                       VARCHAR(255) NOT NULL,
  profile_pic                 VARCHAR(500) DEFAULT NULL,
  password                    VARCHAR(255) NOT NULL,
  status                      INT DEFAULT 0, -- 0 = pending quiz, 1 = active
  level                       VARCHAR(50) DEFAULT 'beginner',
  feedback                    TEXT DEFAULT NULL,
  at_score                    DOUBLE DEFAULT 0,
  p_score                     DOUBLE DEFAULT 0,
  ct_score                    DOUBLE DEFAULT 0,
  ct_tol_easy                 DOUBLE DEFAULT 0,
  ct_tol_med                  DOUBLE DEFAULT 0,
  ct_tol_hard                 DOUBLE DEFAULT 0,
  at_tol_easy                 DOUBLE DEFAULT 0,
  at_tol_med                  DOUBLE DEFAULT 0,
  at_tol_hard                 DOUBLE DEFAULT 0,
  p_tol_easy                  DOUBLE DEFAULT 0,
  p_tol_med                   DOUBLE DEFAULT 0,
  p_tol_hard                  DOUBLE DEFAULT 0,
  username                    VARCHAR(15) DEFAULT NULL,
  total_xp                    INT DEFAULT 0,
  current_level               INT DEFAULT 1,
  current_streak              INT DEFAULT 0,
  longest_streak              INT DEFAULT 0,
  last_login                  DATETIME DEFAULT NULL,
  closed_at                   DATETIME DEFAULT NULL,
  created_at                  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  bio                         TEXT DEFAULT NULL,
  is_verified                 TINYINT(1) DEFAULT 0,
  verification_token          VARCHAR(255) DEFAULT NULL,
  verification_token_expires  DATETIME DEFAULT NULL,
  reset_password_token        VARCHAR(255) DEFAULT NULL,
  reset_password_expires      DATETIME DEFAULT NULL,
  pending_email               VARCHAR(255) DEFAULT NULL,
  weakness                    VARCHAR(255) DEFAULT NULL,

  PRIMARY KEY (student_ID),
  UNIQUE KEY uniq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Quiz Bank (Pool of diagnostic and assessment questions)
CREATE TABLE IF NOT EXISTS quiz_bank (
  q_ID            INT NOT NULL AUTO_INCREMENT,
  question        TEXT NOT NULL,
  option_text     TEXT NOT NULL,
  correct_answer  TEXT NOT NULL,
  category        VARCHAR(100) NOT NULL,
  difficulty_rate VARCHAR(50) NOT NULL,

  PRIMARY KEY (q_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Initial Question Paper (Active diagnostic quiz sheets)
CREATE TABLE IF NOT EXISTS initial_question_paper (
  paper_ID    INT NOT NULL,
  q_ID        INT NOT NULL,
  student_ID  VARCHAR(10) NOT NULL,
  response    TEXT DEFAULT NULL,

  PRIMARY KEY (paper_ID, q_ID, student_ID),
  CONSTRAINT fk_iqp_student FOREIGN KEY (student_ID) REFERENCES student (student_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Study Plan Table (Stores active learning pathways and questions for students)
CREATE TABLE IF NOT EXISTS study_plan (
  plan_id           INT NOT NULL,
  student_ID        VARCHAR(10) NOT NULL,
  week_number       INT NOT NULL,
  module_name       VARCHAR(100) DEFAULT NULL,
  step_ID           INT NOT NULL,
  step_name         VARCHAR(255) DEFAULT NULL,
  gen_QID           VARCHAR(50) NOT NULL,
  learning_content  TEXT,
  question          TEXT NOT NULL,
  options           TEXT NOT NULL,
  correct_answer    TEXT NOT NULL,
  step_status       ENUM('LOCKED','IN_PROGRESS','RETRY_NEEDED','COMPLETED','FAILED_MAX_ATTEMPTS') DEFAULT 'LOCKED',
  attempt_count     INT DEFAULT '0',
  start_date        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      TIMESTAMP NULL DEFAULT NULL,
  user_response     TEXT DEFAULT NULL,

  PRIMARY KEY (plan_id, week_number, step_ID, gen_QID),
  KEY idx_sp_student (student_ID),
  CONSTRAINT fk_sp_student FOREIGN KEY (student_ID) REFERENCES student (student_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Quiz Attempts (History of individual student answers on study plans)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  plan_id         INT NOT NULL,
  week_number     INT NOT NULL,
  step_ID         INT NOT NULL,
  gen_QID         VARCHAR(50) NOT NULL,
  attempt_number  INT NOT NULL,
  student_ID      VARCHAR(10) NOT NULL,
  user_response   TEXT,
  is_correct      TINYINT(1) DEFAULT 0,
  score           DOUBLE DEFAULT 0,
  attempted_at    DATETIME DEFAULT NULL,
  finished_at     DATETIME DEFAULT NULL,

  PRIMARY KEY (plan_id, week_number, step_ID, gen_QID, attempt_number, student_ID),
  CONSTRAINT fk_qa_student FOREIGN KEY (student_ID) REFERENCES student (student_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Reinforcement Learning Interactions Table
CREATE TABLE IF NOT EXISTS rl_interactions (
  id              INT AUTO_INCREMENT,
  student_ID      VARCHAR(50) NOT NULL,
  interaction_id  VARCHAR(100) NOT NULL,
  action_id       INT NOT NULL,
  action_code     VARCHAR(50) NOT NULL,
  risk_score      DECIMAL(10,8) DEFAULT NULL,
  engaged         TINYINT(1) DEFAULT NULL,       -- NULL=pending, 1=engaged, 0=ignored
  feedback_sent   TINYINT(1) DEFAULT 0,          -- 1=feedback successfully delivered to RL API
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  engaged_at      DATETIME DEFAULT NULL,
  expires_at      DATETIME DEFAULT NULL,          -- Auto-expire stale interactions (default: 24h)

  PRIMARY KEY (id),
  INDEX idx_student_pending (student_ID, engaged, feedback_sent),
  INDEX idx_interaction (interaction_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Badges (Supported system awards)
CREATE TABLE IF NOT EXISTS badges (
  badge_id          VARCHAR(50) NOT NULL,
  badge_name        VARCHAR(255) NOT NULL,
  badge_description TEXT NOT NULL,
  icon_url          VARCHAR(500) DEFAULT NULL,

  PRIMARY KEY (badge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. Student Badges (Mapping of students to badges)
CREATE TABLE IF NOT EXISTS student_badges (
  student_ID VARCHAR(10) NOT NULL,
  badge_id   VARCHAR(50) NOT NULL,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (student_ID, badge_id),
  CONSTRAINT fk_sb_student FOREIGN KEY (student_ID) REFERENCES student (student_ID) ON DELETE CASCADE,
  CONSTRAINT fk_sb_badge FOREIGN KEY (badge_id) REFERENCES badges (badge_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
