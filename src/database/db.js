import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "..", "database", "bot_stats.db");

const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
    process.exit(1); // Exit if database connection fails
  } else {
    console.log("Connected to the database.");
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error("Error creating users table:", err.message);
    });

    // Таблица действий
    db.run(`CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action_type TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
      if (err) console.error("Error creating actions table:", err.message);
    });

    // Таблица цитат
    db.run(`CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      quote_text TEXT,
      author TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
      if (err) console.error("Error creating quotes table:", err.message);
    });

    // Таблица ошибок
    db.run(`CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      error_message TEXT,
      stack_trace TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
      if (err) console.error("Error creating errors table:", err.message);
    });
  });
}

export const addUser = (chatId, userInfo) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO users (chat_id, username, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
      [chatId, userInfo.username, userInfo.first_name, userInfo.last_name],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
};

export const updateUserActivity = (chatId) => {
  db.run(
    `UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE chat_id = ?`,
    [chatId],
    (err) => {
      if (err) {
        console.error("Error updating user activity:", err.message);
      }
    }
  );
};

export const logAction = async (chatId, actionType, details = null) => {
  try {
    const userId = await getUserId(chatId);
    if (!userId) {
      throw new Error(`User with chatId ${chatId} not found`);
    }
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO actions (user_id, action_type, details) VALUES (?, ?, ?)`,
        [userId, actionType, JSON.stringify(details)],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  } catch (error) {
    return Promise.reject(error);
  }
};

// Функции для статистики

export const getStats = () => {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT
        COUNT(DISTINCT chat_id) as total_users,
        COUNT(*) as total_actions,
        COUNT(DISTINCT date(timestamp)) as active_days
      FROM users
      JOIN actions ON users.id = actions.user_id
    `,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

export const getPopularActions = (limit = 10) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT action_type, COUNT(*) as count
      FROM actions
      GROUP BY action_type
      ORDER BY count DESC
      LIMIT ?
    `,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

export const getDailyStats = (days = 7) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT
        date(timestamp) as date,
        COUNT(*) as actions_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM actions
      WHERE timestamp >= date('now', '-' || ? || ' days')
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `,
      [days],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

const getUserId = (chatId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id FROM users WHERE chat_id = ?`, [chatId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.id : null);
    });
  });
};

export default db;