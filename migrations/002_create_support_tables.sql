-- Migration: Create Support Chat Tables
-- Description: Creates all necessary tables for the Volunteer Support Chat System
-- Date: 2025-08-28
-- Version: 1.0.0

-- ============================================
-- Support Categories (Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS support_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(20),
    display_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT INTO support_categories (id, name, description, icon, display_order) VALUES
    ('wallet_setup', 'Wallet Setup', 'Help with wallet creation and configuration', '💰', 1),
    ('marketplace_listing', 'Marketplace Listing', 'Creating and managing listings', '📝', 2),
    ('marketplace_buying', 'Marketplace Buying', 'Purchasing items and dispute resolution', '🛒', 3),
    ('dex_trading', 'DEX Trading', 'Trading and liquidity provision', '📈', 4),
    ('technical_issue', 'Technical Issues', 'Bug reports and technical problems', '🔧', 5),
    ('account_recovery', 'Account Recovery', 'Password reset and account access', '🔑', 6),
    ('security', 'Security', 'Security concerns and best practices', '🔒', 7),
    ('general', 'General', 'General questions and other topics', '❓', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Support Volunteers
-- ============================================
CREATE TABLE IF NOT EXISTS support_volunteers (
    address VARCHAR(42) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'busy', 'away')),
    languages TEXT[] DEFAULT '{}',
    expertise_categories TEXT[] DEFAULT '{}',
    participation_score DECIMAL(10,2) DEFAULT 0,
    max_concurrent_sessions INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for volunteers
CREATE INDEX IF NOT EXISTS idx_volunteers_status ON support_volunteers(status);
CREATE INDEX IF NOT EXISTS idx_volunteers_active ON support_volunteers(is_active, status);
CREATE INDEX IF NOT EXISTS idx_volunteers_languages ON support_volunteers USING gin(languages);
CREATE INDEX IF NOT EXISTS idx_volunteers_expertise ON support_volunteers USING gin(expertise_categories);

-- ============================================
-- Support Requests
-- ============================================
CREATE TABLE IF NOT EXISTS support_requests (
    request_id VARCHAR(100) PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    category VARCHAR(50) NOT NULL REFERENCES support_categories(id),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    initial_message TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    user_score DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for requests
CREATE INDEX IF NOT EXISTS idx_requests_user ON support_requests(user_address);
CREATE INDEX IF NOT EXISTS idx_requests_category ON support_requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON support_requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_created ON support_requests(created_at DESC);

-- ============================================
-- Support Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS support_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    request_id VARCHAR(100) REFERENCES support_requests(request_id),
    user_address VARCHAR(42) NOT NULL,
    volunteer_address VARCHAR(42) REFERENCES support_volunteers(address),
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'active', 'resolved', 'abandoned')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assignment_time TIMESTAMP,
    resolution_time TIMESTAMP,
    resolution_notes TEXT,
    initial_message TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    user_score DECIMAL(10,2) DEFAULT 0,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    pop_points_awarded DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_status ON support_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_volunteer ON support_sessions(volunteer_address);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON support_sessions(user_address);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON support_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON support_sessions(category);

-- ============================================
-- Support Messages
-- ============================================
CREATE TABLE IF NOT EXISTS support_messages (
    message_id VARCHAR(100) PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES support_sessions(session_id) ON DELETE CASCADE,
    sender_address VARCHAR(42) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'article_link')),
    attachment JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_session ON support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON support_messages(sender_address);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON support_messages(timestamp);

-- ============================================
-- Support Queue
-- ============================================
CREATE TABLE IF NOT EXISTS support_queue (
    queue_id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES support_sessions(session_id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id)
);

-- Indexes for queue
CREATE INDEX IF NOT EXISTS idx_queue_priority ON support_queue(priority);
CREATE INDEX IF NOT EXISTS idx_queue_created ON support_queue(created_at);

-- ============================================
-- Volunteer Schedules
-- ============================================
CREATE TABLE IF NOT EXISTS volunteer_schedules (
    schedule_id SERIAL PRIMARY KEY,
    volunteer_address VARCHAR(42) REFERENCES support_volunteers(address) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volunteer_address, day_of_week, start_time)
);

-- Indexes for schedules
CREATE INDEX IF NOT EXISTS idx_schedules_volunteer ON volunteer_schedules(volunteer_address);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON volunteer_schedules(day_of_week);

-- ============================================
-- Schedule Overrides
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_overrides (
    override_id SERIAL PRIMARY KEY,
    volunteer_address VARCHAR(42) REFERENCES support_volunteers(address) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    available BOOLEAN NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volunteer_address, override_date)
);

-- Indexes for overrides
CREATE INDEX IF NOT EXISTS idx_overrides_volunteer ON schedule_overrides(volunteer_address);
CREATE INDEX IF NOT EXISTS idx_overrides_date ON schedule_overrides(override_date);

-- ============================================
-- Quality Metrics
-- ============================================
CREATE TABLE IF NOT EXISTS support_quality_metrics (
    metric_id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES support_sessions(session_id) ON DELETE CASCADE,
    clarity BOOLEAN DEFAULT true,
    accuracy BOOLEAN DEFAULT true,
    professionalism BOOLEAN DEFAULT true,
    helpfulness BOOLEAN DEFAULT true,
    resolved BOOLEAN DEFAULT false,
    resolution_method TEXT,
    follow_up_needed BOOLEAN DEFAULT false,
    docs_shared INTEGER DEFAULT 0,
    explanations_given INTEGER DEFAULT 0,
    visual_aids_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id)
);

-- Index for quality metrics
CREATE INDEX IF NOT EXISTS idx_quality_session ON support_quality_metrics(session_id);

-- ============================================
-- Support Analytics
-- ============================================
CREATE TABLE IF NOT EXISTS support_analytics (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    session_id VARCHAR(100),
    volunteer_address VARCHAR(42),
    user_address VARCHAR(42),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_support_analytics_type ON support_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_support_analytics_session ON support_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_support_analytics_volunteer ON support_analytics(volunteer_address);
CREATE INDEX IF NOT EXISTS idx_support_analytics_time ON support_analytics(created_at DESC);

-- ============================================
-- Useful Views
-- ============================================

-- Volunteer performance view
CREATE OR REPLACE VIEW v_volunteer_performance AS
SELECT 
    v.address,
    v.display_name,
    v.status,
    v.participation_score,
    COUNT(DISTINCT s.session_id) as total_sessions,
    COUNT(DISTINCT CASE WHEN s.start_time > NOW() - INTERVAL '30 days' THEN s.session_id END) as recent_sessions,
    COALESCE(AVG(s.user_rating), 5) as avg_rating,
    COUNT(s.user_rating) as ratings_count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (s.assignment_time - s.start_time))), 0) as avg_response_seconds,
    COALESCE(AVG(EXTRACT(EPOCH FROM (s.resolution_time - s.assignment_time)) / 60), 30) as avg_resolution_minutes,
    COUNT(CASE WHEN s.status = 'resolved' THEN 1 END)::float / 
        NULLIF(COUNT(s.session_id), 0)::float as resolution_rate,
    SUM(s.pop_points_awarded) as total_pop_earned
FROM support_volunteers v
LEFT JOIN support_sessions s ON v.address = s.volunteer_address
GROUP BY v.address, v.display_name, v.status, v.participation_score;

-- Session statistics view
CREATE OR REPLACE VIEW v_support_session_stats AS
SELECT 
    DATE_TRUNC('day', start_time) as date,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_sessions,
    COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_sessions,
    AVG(EXTRACT(EPOCH FROM (COALESCE(assignment_time, NOW()) - start_time))) as avg_wait_seconds,
    AVG(EXTRACT(EPOCH FROM (resolution_time - assignment_time)) / 60) as avg_resolution_minutes,
    AVG(user_rating) as avg_rating,
    COUNT(DISTINCT volunteer_address) as unique_volunteers,
    COUNT(DISTINCT user_address) as unique_users
FROM support_sessions
WHERE start_time > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', start_time)
ORDER BY date DESC;

-- Current system status view
CREATE OR REPLACE VIEW v_support_system_status AS
SELECT 
    (SELECT COUNT(*) FROM support_volunteers WHERE status = 'available' AND is_active = true) as available_volunteers,
    (SELECT COUNT(*) FROM support_sessions WHERE status = 'waiting') as waiting_requests,
    (SELECT COUNT(*) FROM support_sessions WHERE status IN ('assigned', 'active')) as active_sessions,
    (SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(assignment_time, NOW()) - start_time))) 
     FROM support_sessions WHERE start_time > NOW() - INTERVAL '1 hour') as recent_avg_wait_seconds,
    (SELECT COUNT(*) FROM support_sessions WHERE start_time > NOW() - INTERVAL '24 hours') as sessions_today;

-- ============================================
-- Functions for Common Operations
-- ============================================

-- Function to get volunteer availability
CREATE OR REPLACE FUNCTION is_volunteer_available(volunteer_addr VARCHAR, check_time TIMESTAMP DEFAULT NOW())
RETURNS BOOLEAN AS $$
DECLARE
    is_available BOOLEAN;
    day_of_week_num INTEGER;
    check_time_only TIME;
BEGIN
    -- Check if volunteer exists and is active
    SELECT EXISTS(
        SELECT 1 FROM support_volunteers 
        WHERE address = volunteer_addr 
        AND is_active = true 
        AND status = 'available'
    ) INTO is_available;
    
    IF NOT is_available THEN
        RETURN FALSE;
    END IF;
    
    -- Check schedule overrides first
    SELECT available INTO is_available
    FROM schedule_overrides
    WHERE volunteer_address = volunteer_addr
    AND override_date = check_time::DATE;
    
    IF FOUND THEN
        RETURN is_available;
    END IF;
    
    -- Check regular schedule
    day_of_week_num := EXTRACT(DOW FROM check_time);
    check_time_only := check_time::TIME;
    
    RETURN EXISTS(
        SELECT 1 
        FROM volunteer_schedules
        WHERE volunteer_address = volunteer_addr
        AND day_of_week = day_of_week_num
        AND start_time <= check_time_only
        AND end_time >= check_time_only
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate volunteer load
CREATE OR REPLACE FUNCTION get_volunteer_load(volunteer_addr VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE((
        SELECT COUNT(*) 
        FROM support_sessions
        WHERE volunteer_address = volunteer_addr
        AND status IN ('assigned', 'active')
    ), 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Update volunteer last_active on any session activity
CREATE OR REPLACE FUNCTION update_volunteer_last_active() RETURNS trigger AS $$
BEGIN
    IF NEW.volunteer_address IS NOT NULL THEN
        UPDATE support_volunteers 
        SET last_active = NOW() 
        WHERE address = NEW.volunteer_address;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_activity_trigger
    AFTER INSERT OR UPDATE ON support_sessions
    FOR EACH ROW EXECUTE FUNCTION update_volunteer_last_active();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_volunteers_updated_at
    BEFORE UPDATE ON support_volunteers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Initial Data
-- ============================================

-- Insert sample volunteer (for testing)
INSERT INTO support_volunteers (
    address, display_name, status, languages, 
    expertise_categories, participation_score, max_concurrent_sessions
) VALUES (
    '0x1234567890123456789012345678901234567890',
    'Test Volunteer',
    'available',
    ARRAY['en', 'es'],
    ARRAY['wallet_setup', 'general'],
    85,
    3
) ON CONFLICT (address) DO NOTHING;

-- ============================================
-- Permissions (adjust as needed)
-- ============================================
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO omnibazaar_app;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO omnibazaar_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO omnibazaar_app;