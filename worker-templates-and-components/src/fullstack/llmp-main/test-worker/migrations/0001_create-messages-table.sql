-- Migration number: 0001 	 2024-09-25T16:29:06.475Z
-- Create messages table
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    summary TEXT,
    role TEXT NOT NULL CHECK(role IN ('user', 'ai')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index on user_id for faster queries
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- Add index on role for faster queries
CREATE INDEX idx_messages_role ON messages(role);

-- Add index on created_at for faster sorting and filtering
CREATE INDEX idx_messages_created_at ON messages(created_at);
