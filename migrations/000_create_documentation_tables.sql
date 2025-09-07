-- Migration: Create Documentation Tables
-- Description: Creates all necessary tables for the Documentation Service
-- Date: 2025-08-28
-- Version: 1.0.0

-- ============================================
-- Documentation Categories (Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS documentation_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(20),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO documentation_categories (id, name, description, icon, display_order) VALUES
    ('getting_started', 'Getting Started', 'Guides for new users', '🚀', 1),
    ('wallet', 'Wallet', 'Wallet-related documentation', '💰', 2),
    ('marketplace', 'Marketplace', 'Marketplace usage guides', '🛒', 3),
    ('dex', 'DEX', 'Decentralized exchange documentation', '📈', 4),
    ('technical', 'Technical', 'Technical documentation for developers', '🔧', 5),
    ('faq', 'FAQ', 'Frequently asked questions', '❓', 6),
    ('governance', 'Governance', 'Governance and DAO documentation', '🗳️', 7),
    ('security', 'Security', 'Security best practices', '🔒', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Main Documents Table
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL REFERENCES documentation_categories(id),
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    version INTEGER DEFAULT 1,
    author_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT[] DEFAULT '{}',
    is_official BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    search_vector tsvector
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_language ON documents(language);
CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author_address);
CREATE INDEX IF NOT EXISTS idx_documents_official ON documents(is_official);
CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING gin(metadata);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_document_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        NEW.title || ' ' || 
        NEW.description || ' ' || 
        NEW.content || ' ' || 
        COALESCE(array_to_string(NEW.tags, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_search_vector_update
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_document_search_vector();

-- ============================================
-- Document Ratings
-- ============================================
CREATE TABLE IF NOT EXISTS document_ratings (
    document_id VARCHAR(100) REFERENCES documents(id) ON DELETE CASCADE,
    user_address VARCHAR(42) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, user_address)
);

-- Index for ratings
CREATE INDEX IF NOT EXISTS idx_ratings_document ON document_ratings(document_id);

-- Trigger to update document average rating
CREATE OR REPLACE FUNCTION update_document_rating() RETURNS trigger AS $$
BEGIN
    UPDATE documents 
    SET rating = (
        SELECT AVG(rating)::DECIMAL(3,2) 
        FROM document_ratings 
        WHERE document_id = NEW.document_id
    )
    WHERE id = NEW.document_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_rating_update
    AFTER INSERT OR UPDATE ON document_ratings
    FOR EACH ROW EXECUTE FUNCTION update_document_rating();

-- ============================================
-- Document Contributions
-- ============================================
CREATE TABLE IF NOT EXISTS document_contributions (
    id VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100) REFERENCES documents(id),
    contributor_address VARCHAR(42) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    change_description TEXT,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewer_address VARCHAR(42),
    review_notes TEXT,
    pop_points_awarded DECIMAL(10,2) DEFAULT 0
);

-- Indexes for contributions
CREATE INDEX IF NOT EXISTS idx_contributions_document ON document_contributions(document_id);
CREATE INDEX IF NOT EXISTS idx_contributions_contributor ON document_contributions(contributor_address);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON document_contributions(status);

-- ============================================
-- Document Version History
-- ============================================
CREATE TABLE IF NOT EXISTS document_versions (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(100) REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    editor_address VARCHAR(42) NOT NULL,
    change_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, version)
);

-- Indexes for versions
CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON document_versions(created_at DESC);

-- ============================================
-- Documentation Proposals (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS documentation_proposals (
    proposal_id VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100) NOT NULL,
    new_content TEXT NOT NULL,
    new_metadata JSONB,
    proposer_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    voting_ends_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'voting',
    consensus_result JSONB,
    executed_at TIMESTAMP
);

-- Indexes for proposals
CREATE INDEX IF NOT EXISTS idx_proposals_status ON documentation_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_voting_ends ON documentation_proposals(voting_ends_at);

-- ============================================
-- Documentation Votes (Consensus)
-- ============================================
CREATE TABLE IF NOT EXISTS documentation_votes (
    proposal_id VARCHAR(100) REFERENCES documentation_proposals(proposal_id),
    validator_address VARCHAR(42) NOT NULL,
    vote VARCHAR(10) NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    reason TEXT,
    stake_weight INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proposal_id, validator_address)
);

-- Index for votes
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON documentation_votes(proposal_id);

-- ============================================
-- Document View Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS document_views (
    document_id VARCHAR(100) REFERENCES documents(id) ON DELETE CASCADE,
    viewer_address VARCHAR(42),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(64),
    user_agent VARCHAR(255)
);

-- Indexes for views
CREATE INDEX IF NOT EXISTS idx_views_document ON document_views(document_id);
CREATE INDEX IF NOT EXISTS idx_views_time ON document_views(viewed_at DESC);

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_document_views() RETURNS trigger AS $$
BEGIN
    UPDATE documents 
    SET view_count = view_count + 1 
    WHERE id = NEW.document_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_view_counter
    AFTER INSERT ON document_views
    FOR EACH ROW EXECUTE FUNCTION increment_document_views();

-- ============================================
-- Document Translations
-- ============================================
CREATE TABLE IF NOT EXISTS document_translations (
    document_id VARCHAR(100) REFERENCES documents(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    translator_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_approved BOOLEAN DEFAULT false,
    PRIMARY KEY (document_id, language)
);

-- Indexes for translations
CREATE INDEX IF NOT EXISTS idx_translations_language ON document_translations(language);
CREATE INDEX IF NOT EXISTS idx_translations_approved ON document_translations(is_approved);

-- ============================================
-- Search Suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS documentation_search_suggestions (
    query VARCHAR(255) PRIMARY KEY,
    frequency INTEGER DEFAULT 1,
    last_searched TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for search suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_frequency ON documentation_search_suggestions(frequency DESC);

-- ============================================
-- Documentation Analytics
-- ============================================
CREATE TABLE IF NOT EXISTS documentation_analytics (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    document_id VARCHAR(100),
    user_address VARCHAR(42),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_type ON documentation_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_document ON documentation_analytics(document_id);
CREATE INDEX IF NOT EXISTS idx_analytics_time ON documentation_analytics(created_at DESC);

-- ============================================
-- Useful Views
-- ============================================

-- Popular documents view
CREATE OR REPLACE VIEW v_popular_documents AS
SELECT 
    d.*,
    COUNT(DISTINCT dv.viewer_address) as unique_viewers,
    COUNT(dr.user_address) as rating_count
FROM documents d
LEFT JOIN document_views dv ON d.id = dv.document_id
LEFT JOIN document_ratings dr ON d.id = dr.document_id
GROUP BY d.id
ORDER BY d.view_count DESC;

-- Document statistics view
CREATE OR REPLACE VIEW v_document_stats AS
SELECT 
    d.category,
    COUNT(*) as document_count,
    COUNT(CASE WHEN d.is_official THEN 1 END) as official_count,
    AVG(d.rating) as avg_rating,
    SUM(d.view_count) as total_views
FROM documents d
GROUP BY d.category;

-- Recent contributions view
CREATE OR REPLACE VIEW v_recent_contributions AS
SELECT 
    dc.*,
    d.title as document_title
FROM document_contributions dc
LEFT JOIN documents d ON dc.document_id = d.id
WHERE dc.created_at > NOW() - INTERVAL '30 days'
ORDER BY dc.created_at DESC;

-- ============================================
-- Functions for Common Operations
-- ============================================

-- Function to get related documents
CREATE OR REPLACE FUNCTION get_related_documents(doc_id VARCHAR, limit_count INTEGER DEFAULT 5)
RETURNS TABLE(id VARCHAR, title VARCHAR, similarity REAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d2.id,
        d2.title,
        ts_rank(d2.search_vector, query) as similarity
    FROM documents d1, documents d2, to_tsquery('english', 
        (SELECT string_agg(tag, ' | ') FROM unnest(d1.tags) as tag)
    ) query
    WHERE d1.id = doc_id 
    AND d2.id != doc_id
    AND d2.search_vector @@ query
    ORDER BY similarity DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate contributor statistics
CREATE OR REPLACE FUNCTION get_contributor_stats(contributor VARCHAR)
RETURNS TABLE(
    total_contributions INTEGER,
    approved_contributions INTEGER,
    total_points_earned DECIMAL,
    languages_contributed TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_contributions,
        COUNT(CASE WHEN status = 'approved' THEN 1 END)::INTEGER as approved_contributions,
        SUM(pop_points_awarded) as total_points_earned,
        array_agg(DISTINCT language) as languages_contributed
    FROM document_contributions
    WHERE contributor_address = contributor;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Initial Data
-- ============================================

-- Insert sample validators (for testing consensus)
INSERT INTO validators (address, is_active, stake) VALUES
    ('0x1234567890123456789012345678901234567890', true, 10000),
    ('0x2345678901234567890123456789012345678901', true, 15000),
    ('0x3456789012345678901234567890123456789012', true, 12000),
    ('0x4567890123456789012345678901234567890123', true, 8000)
ON CONFLICT (address) DO NOTHING;

-- ============================================
-- Permissions (adjust as needed)
-- ============================================
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO omnibazaar_app;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO omnibazaar_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO omnibazaar_app;