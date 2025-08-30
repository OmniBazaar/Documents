-- Migration: Create Forum Tables
-- Description: Creates all necessary tables for the P2P Forum Service
-- Date: 2025-01-29
-- Version: 1.0.0

-- ============================================
-- Forum Categories (Static Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(20),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO forum_categories (id, name, description, icon, display_order) VALUES
    ('wallet', 'OmniWallet Support', 'Help with wallet features and issues', '💰', 1),
    ('marketplace', 'Marketplace Help', 'Buying and selling assistance', '🛒', 2),
    ('dex', 'DEX Trading', 'Decentralized exchange support', '📈', 3),
    ('technical', 'Technical Support', 'Technical issues and bug reports', '🔧', 4),
    ('feature', 'Feature Requests', 'Suggest new features and improvements', '💡', 5),
    ('governance', 'Community Governance', 'Proposals and community voting', '🗳️', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Forum Threads
-- ============================================
CREATE TABLE IF NOT EXISTS forum_threads (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL REFERENCES forum_categories(id),
    author_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    search_vector tsvector
);

-- Indexes for threads
CREATE INDEX IF NOT EXISTS idx_threads_category ON forum_threads(category);
CREATE INDEX IF NOT EXISTS idx_threads_author ON forum_threads(author_address);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON forum_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_search ON forum_threads USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_threads_tags ON forum_threads USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_threads_active ON forum_threads(is_deleted, is_pinned DESC, updated_at DESC);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_thread_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', NEW.title || ' ' || COALESCE(array_to_string(NEW.tags, ' '), ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_search_vector_update
    BEFORE INSERT OR UPDATE ON forum_threads
    FOR EACH ROW EXECUTE FUNCTION update_thread_search_vector();

-- ============================================
-- Forum Posts
-- ============================================
CREATE TABLE IF NOT EXISTS forum_posts (
    id VARCHAR(100) PRIMARY KEY,
    thread_id VARCHAR(100) NOT NULL REFERENCES forum_threads(id),
    parent_id VARCHAR(100) REFERENCES forum_posts(id),
    author_address VARCHAR(42) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_accepted_answer BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT false,
    hide_reason VARCHAR(50),
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    visibility_score DECIMAL(5,2) DEFAULT 50,
    quality_score DECIMAL(5,2) DEFAULT 50,
    search_vector tsvector
);

-- Indexes for posts
CREATE INDEX IF NOT EXISTS idx_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON forum_posts(parent_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON forum_posts(author_address);
CREATE INDEX IF NOT EXISTS idx_posts_created ON forum_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON forum_posts(is_deleted, is_hidden, visibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_search ON forum_posts USING gin(search_vector);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_post_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_search_vector_update
    BEFORE INSERT OR UPDATE ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_post_search_vector();

-- Trigger to update thread stats
CREATE OR REPLACE FUNCTION update_thread_stats() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE forum_threads 
        SET reply_count = reply_count + 1,
            last_reply_at = NEW.created_at,
            updated_at = NEW.created_at
        WHERE id = NEW.thread_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_thread_stats_update
    AFTER INSERT ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_thread_stats();

-- ============================================
-- Forum Votes
-- ============================================
CREATE TABLE IF NOT EXISTS forum_votes (
    id VARCHAR(100) PRIMARY KEY,
    post_id VARCHAR(100) NOT NULL REFERENCES forum_posts(id),
    voter_address VARCHAR(42) NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, voter_address)
);

-- Indexes for votes
CREATE INDEX IF NOT EXISTS idx_votes_post ON forum_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON forum_votes(voter_address);

-- ============================================
-- Forum Moderation
-- ============================================
CREATE TABLE IF NOT EXISTS forum_moderation (
    id VARCHAR(100) PRIMARY KEY,
    action VARCHAR(20) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('thread', 'post')),
    moderator_address VARCHAR(42) NOT NULL,
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_reversed BOOLEAN DEFAULT false,
    reversed_at TIMESTAMP,
    reversed_by VARCHAR(42)
);

-- Indexes for moderation
CREATE INDEX IF NOT EXISTS idx_moderation_target ON forum_moderation(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_moderation_moderator ON forum_moderation(moderator_address);
CREATE INDEX IF NOT EXISTS idx_moderation_timestamp ON forum_moderation(timestamp DESC);

-- ============================================
-- Forum User Stats (For Incentives)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_user_stats (
    address VARCHAR(42) PRIMARY KEY,
    threads_created INTEGER DEFAULT 0,
    posts_made INTEGER DEFAULT 0,
    upvotes_received INTEGER DEFAULT 0,
    downvotes_received INTEGER DEFAULT 0,
    accepted_answers INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    avg_quality_score DECIMAL(5,2) DEFAULT 0,
    languages_supported TEXT[] DEFAULT '{}',
    reputation_score DECIMAL(10,2) DEFAULT 0,
    is_moderator BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user stats
CREATE INDEX IF NOT EXISTS idx_user_stats_reputation ON forum_user_stats(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_activity ON forum_user_stats(last_activity_date DESC);

-- ============================================
-- Forum Point Awards (PoP Integration)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_point_awards (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    points DECIMAL(10,2) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for point awards
CREATE INDEX IF NOT EXISTS idx_awards_address ON forum_point_awards(address);
CREATE INDEX IF NOT EXISTS idx_awards_reason ON forum_point_awards(reason);
CREATE INDEX IF NOT EXISTS idx_awards_time ON forum_point_awards(awarded_at DESC);

-- ============================================
-- Forum Post Tracking (Quality Evaluation)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_post_tracking (
    post_id VARCHAR(100) PRIMARY KEY,
    author_address VARCHAR(42) NOT NULL,
    quality_evaluated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Forum Daily Bonuses
-- ============================================
CREATE TABLE IF NOT EXISTS forum_daily_bonuses (
    address VARCHAR(42),
    date DATE,
    bonus_points DECIMAL(10,2),
    PRIMARY KEY (address, date)
);

-- ============================================
-- Forum Vote Aggregation (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_vote_aggregation (
    post_id VARCHAR(100),
    voter_address VARCHAR(42),
    vote_type VARCHAR(10),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, voter_address)
);

-- ============================================
-- Forum Content Stats (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_content_stats (
    post_id VARCHAR(100) PRIMARY KEY,
    total_votes INTEGER DEFAULT 0,
    upvote_ratio DECIMAL(3,2) DEFAULT 0,
    quality_score DECIMAL(5,2) DEFAULT 50,
    spam_score DECIMAL(3,2) DEFAULT 0,
    last_vote_at TIMESTAMP,
    last_analyzed_at TIMESTAMP
);

-- ============================================
-- Forum Moderation Requests (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_moderation_requests (
    id VARCHAR(100) PRIMARY KEY,
    action VARCHAR(20) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(10) NOT NULL,
    moderator_address VARCHAR(42) NOT NULL,
    reason TEXT,
    details JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    consensus_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- Forum Moderation Log (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_moderation_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(20) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(10) NOT NULL,
    moderator_address VARCHAR(42),
    reason TEXT,
    automated BOOLEAN DEFAULT false,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Forum Review Queue (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_review_queue (
    post_id VARCHAR(100) PRIMARY KEY,
    reason VARCHAR(50),
    priority VARCHAR(10) DEFAULT 'medium',
    reviewer_address VARCHAR(42),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP
);

-- ============================================
-- Forum Notification Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS forum_notification_preferences (
    address VARCHAR(42) PRIMARY KEY,
    notify_on_thread_reply BOOLEAN DEFAULT true,
    notify_on_post_reply BOOLEAN DEFAULT true,
    notify_on_mention BOOLEAN DEFAULT true,
    notify_on_upvote BOOLEAN DEFAULT false,
    notify_on_accepted_answer BOOLEAN DEFAULT true,
    channel_in_app BOOLEAN DEFAULT true,
    channel_email BOOLEAN DEFAULT false,
    channel_push BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Forum Badges
-- ============================================
CREATE TABLE IF NOT EXISTS forum_badges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(20),
    rarity VARCHAR(20) DEFAULT 'common',
    requirements JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User badges junction table
CREATE TABLE IF NOT EXISTS forum_user_badges (
    address VARCHAR(42),
    badge_id VARCHAR(50) REFERENCES forum_badges(id),
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (address, badge_id)
);

-- Insert default badges
INSERT INTO forum_badges (id, name, description, icon, rarity, requirements) VALUES
    ('first_post', 'First Steps', 'Created your first forum post', '👶', 'common', '{"posts": 1}'),
    ('helpful', 'Helpful Member', 'Received 10 upvotes on posts', '👍', 'common', '{"upvotes_received": 10}'),
    ('problem_solver', 'Problem Solver', 'Had 5 answers accepted', '✅', 'uncommon', '{"accepted_answers": 5}'),
    ('active_contributor', 'Active Contributor', 'Posted for 30 consecutive days', '🔥', 'rare', '{"streak_days": 30}'),
    ('community_leader', 'Community Leader', 'Reached 100 reputation score', '👑', 'epic', '{"reputation": 100}'),
    ('moderator', 'Moderator', 'Became a forum moderator', '🛡️', 'legendary', '{"is_moderator": true}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Views for Common Queries
-- ============================================

-- Active threads view
CREATE OR REPLACE VIEW v_active_threads AS
SELECT 
    t.*,
    u.reputation_score as author_reputation,
    c.name as category_name,
    c.icon as category_icon
FROM forum_threads t
LEFT JOIN forum_user_stats u ON t.author_address = u.address
LEFT JOIN forum_categories c ON t.category = c.id
WHERE t.is_deleted = false
ORDER BY 
    t.is_pinned DESC,
    t.updated_at DESC;

-- Thread with stats view
CREATE OR REPLACE VIEW v_thread_stats AS
SELECT 
    t.*,
    COUNT(DISTINCT p.author_address) as unique_participants,
    MAX(p.created_at) as last_post_at,
    SUM(CASE WHEN p.is_accepted_answer THEN 1 ELSE 0 END) as accepted_answers
FROM forum_threads t
LEFT JOIN forum_posts p ON t.id = p.thread_id AND p.is_deleted = false
GROUP BY t.id;

-- User reputation view
CREATE OR REPLACE VIEW v_user_reputation AS
SELECT 
    u.*,
    COUNT(DISTINCT b.badge_id) as badge_count,
    COALESCE(SUM(a.points), 0) as total_points_earned
FROM forum_user_stats u
LEFT JOIN forum_user_badges b ON u.address = b.address
LEFT JOIN forum_point_awards a ON u.address = a.address
GROUP BY u.address;

-- ============================================
-- Functions for Common Operations
-- ============================================

-- Function to calculate user reputation
CREATE OR REPLACE FUNCTION calculate_user_reputation(user_address VARCHAR) 
RETURNS DECIMAL AS $$
DECLARE
    reputation DECIMAL;
BEGIN
    SELECT 
        COALESCE(threads_created * 0.5, 0) +
        COALESCE(posts_made * 0.1, 0) +
        COALESCE(upvotes_received * 0.2, 0) +
        COALESCE(accepted_answers * 2, 0) -
        COALESCE(downvotes_received * 0.1, 0) +
        COALESCE(streak_days * 0.1, 0)
    INTO reputation
    FROM forum_user_stats
    WHERE address = user_address;
    
    RETURN COALESCE(reputation, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get thread activity score
CREATE OR REPLACE FUNCTION get_thread_activity_score(thread_id VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
    score DECIMAL;
    age_hours INTEGER;
BEGIN
    SELECT 
        (reply_count * 2) + 
        (view_count * 0.1) +
        (CASE WHEN last_reply_at > NOW() - INTERVAL '24 hours' THEN 10 ELSE 0 END) +
        (CASE WHEN last_reply_at > NOW() - INTERVAL '7 days' THEN 5 ELSE 0 END),
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
    INTO score, age_hours
    FROM forum_threads
    WHERE id = thread_id;
    
    -- Apply time decay
    score := score * POWER(0.95, age_hours / 24);
    
    RETURN COALESCE(score, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Permissions (adjust as needed)
-- ============================================
-- Grant appropriate permissions to the application user
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO omnibazaar_app;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO omnibazaar_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO omnibazaar_app;