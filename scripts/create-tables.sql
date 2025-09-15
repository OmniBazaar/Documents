-- Documents Module Database Schema

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    version INTEGER NOT NULL DEFAULT 1,
    author_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tags TEXT[] DEFAULT '{}',
    is_official BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    rating FLOAT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    ipfs_hash VARCHAR(100),
    published_at TIMESTAMP
);

-- Forum threads table
CREATE TABLE IF NOT EXISTS forum_threads (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    author_address VARCHAR(42) NOT NULL,
    author_username VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMP,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    score INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Forum posts table
CREATE TABLE IF NOT EXISTS forum_posts (
    id UUID PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    parent_id UUID,
    author_address VARCHAR(42) NOT NULL,
    author_username VARCHAR(50),
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    is_accepted_answer BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- Support categories table
CREATE TABLE IF NOT EXISTS support_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- Insert default categories if not exist
INSERT INTO support_categories (id, name, description) VALUES
    ('general', 'General', 'General support questions'),
    ('seller-violation', 'Seller Violation', 'Report seller violations'),
    ('buyer-issue', 'Buyer Issue', 'Report buyer issues'),
    ('technical', 'Technical', 'Technical support'),
    ('payment', 'Payment', 'Payment related issues'),
    ('shipping', 'Shipping', 'Shipping related issues'),
    ('dispute', 'Dispute', 'Dispute resolution'),
    ('account', 'Account', 'Account related issues'),
    ('security', 'Security', 'Security concerns'),
    ('feature-request', 'Feature Request', 'Feature requests and suggestions')
ON CONFLICT (id) DO NOTHING;

-- Support requests table (matching production schema)
CREATE TABLE IF NOT EXISTS support_requests (
    request_id VARCHAR(100) PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    category VARCHAR(50) NOT NULL REFERENCES support_categories(id),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    initial_message TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    user_score DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_documents_author ON documents(author_address);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_forum_threads_author ON forum_threads(author_address);
CREATE INDEX idx_forum_threads_category ON forum_threads(category);
CREATE INDEX idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX idx_forum_posts_author ON forum_posts(author_address);
CREATE INDEX idx_requests_user ON support_requests(user_address);
CREATE INDEX idx_requests_category ON support_requests(category);
CREATE INDEX idx_requests_priority ON support_requests(priority);
CREATE INDEX idx_requests_created ON support_requests(created_at DESC);