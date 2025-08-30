# OmniBazaar Decentralized Support System Plan

**Created:** 2025-01-29  
**Updated:** 2025-01-29  
**Purpose:** Design and implement a fully decentralized documentation, forum, and support system for OmniBazaar  
**Status:** FINAL DESIGN - Ready for Implementation

## Executive Summary

This document outlines a comprehensive plan for implementing a decentralized help/knowledge-base/support/forum system for OmniBazaar users. The system will be completely peer-to-peer, validator-operated, and integrated with the existing Proof of Participation (PoP) scoring system.

## System Components

### 1. Documentation Repository System

#### Final Solution: **YugabyteDB-Based Documentation with Validator Consensus**

**Architecture:**
- Store all documentation as structured Markdown in YugabyteDB
- Use validator consensus for official documentation updates
- Implement version control using timestamps and revision tracking
- Automatic replication across all validators via YugabyteDB
- IPFS only for large media files (videos, PDFs > 10MB)

**Implementation:**
```typescript
// src/services/documentation/DocumentationService.ts
- Document storage and retrieval
- Version management
- Search indexing
- Multi-language support

// src/services/documentation/DocumentationConsensus.ts
- Validator voting on documentation changes
- Official documentation merkle tree
- Update proposals and reviews
```

**Features:**
- Comprehensive search using existing SearchEngine service
- Automatic translation support
- Offline availability via IPFS pinning
- Community contribution workflow
- PoP points for approved contributions

### 2. User Forum System

#### Final Solution: **YugabyteDB-Based Forum with P2P Sync**

Based on research, we'll create a custom solution inspired by:
- **Retroshare's** offline-first design and friend-trust model
- **IPFS-Boards** decentralized moderation concepts
- **Discourse's** user experience
- All storage in YugabyteDB for simplicity and consistency

**Architecture:**
```typescript
// src/services/forum/P2PForumService.ts
- Topic creation and management
- Post/reply threading
- Reputation-based moderation
- Search and discovery

// src/services/forum/ForumConsensus.ts
- Vote aggregation
- Spam detection
- Content moderation consensus

// src/services/forum/ForumIncentives.ts
- PoP point distribution
- Quality answer rewards
- Moderator rewards
```

**Key Features:**
1. **Decentralized Storage**
   - All posts and metadata stored in YugabyteDB
   - Automatic replication via YugabyteDB
   - Media attachments > 10MB on IPFS

2. **Reputation System**
   - Upvotes/downvotes affect user PoP scores
   - Quality answers earn PoP points
   - Spam/low-quality posts reduce PoP

3. **Categories & Tags**
   - OmniWallet Support
   - Marketplace Help
   - DEX Trading
   - Technical Support
   - Feature Requests
   - Community Governance

4. **Moderation**
   - Community-driven moderation
   - Validator consensus for serious violations
   - Appeal process through arbitration

### 3. Support Chat System

#### Final Solution: **Volunteer-First Support System**

Based on cost analysis, we'll start with human volunteers and add AI later:

**Phase 1: Human Volunteer Support (Launch)**
- Volunteers earn significant PoP points (2-7 per session)
- Real-time availability system
- Expertise matching (wallet, DEX, marketplace)
- Quality ratings affect rewards

**Phase 2: AI Enhancement (Future)**
- After collecting 10k+ support conversations
- Deploy 13B INT8 model on opt-in validators
- Validators with 16GB+ GPUs earn extra PoP
- Estimated additional cost: $50-100/month per AI validator

**Implementation:**
```typescript
// src/services/support/AIupportAgent.ts
- LLM integration (local or Bittensor)
- Context-aware responses
- Documentation retrieval
- Escalation detection

// src/services/support/VolunteerSupportService.ts
- Volunteer availability tracking
- Skill matching
- Session management
- PoP point distribution

// src/services/support/SupportRouter.ts
- Intelligent routing
- Load balancing
- Quality monitoring
- Analytics
```

## Proof of Participation (PoP) Integration

### Point Allocation System

1. **Documentation Contributions**
   - Minor correction: 0.1 points
   - New section: 0.5-2 points
   - Full guide/tutorial: 3-5 points
   - Translation: 1-3 points

2. **Forum Activity**
   - Quality answer (upvoted): 0.2 points per upvote (max 2 points)
   - Accepted answer: 1 point
   - Helpful post: 0.1 point per upvote (max 1 point)
   - Moderation action: 0.5 points

3. **Support Chat**
   - Successful AI resolution: 0 points (automated)
   - Volunteer session (positive rating): 2-5 points
   - Expert assistance: 3-7 points
   - Language support: +1 point bonus

### Quality Controls

1. **Anti-Gaming Measures**
   - Daily contribution limits
   - Peer review requirements
   - Validator consensus for large rewards
   - Decay for low-quality contributions

2. **Incentive Alignment**
   - Higher rewards for helping new users
   - Bonus for multilingual support
   - Extra points during high-demand periods
   - Streak bonuses for consistent volunteers

## Technical Architecture

### Data Flow

```
User Query → P2P Network → Validators → Response
     ↓                         ↓           ↑
Documentation ← IPFS ← Consensus → Cache
     ↓                         ↓           ↑
Forum Posts ← YugabyteDB ← Sync → Search
     ↓                         ↓           ↑
Chat Support ← AI/Volunteer ← Route → PoP
```

### Storage Strategy

1. **YugabyteDB Storage (Primary)**
   - All documentation content
   - Forum posts and metadata
   - User profiles and PoP scores
   - Support session records
   - Search indices
   - Version history

2. **IPFS Storage (Media Only)**
   - Large media files > 10MB
   - Video tutorials
   - PDF documentation
   - Image attachments

3. **Validator Memory**
   - Hot cache for popular content
   - Active chat sessions
   - Real-time forum updates
   - AI model (if local)

### Search Integration

Leverage existing SearchEngine service:
- Full-text search across all content
- Semantic search using embeddings
- Multi-language support
- Faceted filtering

## Implementation Phases

### Phase 1: Documentation System (Weeks 1-2)
1. IPFS storage implementation
2. Documentation structure design
3. Search integration
4. Basic UI in wallet/marketplace

### Phase 2: Forum System (Weeks 3-5)
1. P2P forum protocol
2. IPFS content storage
3. Voting and moderation
4. PoP integration

### Phase 3: AI Support Agent (Weeks 6-7)
1. LLM selection and deployment
2. Fine-tuning on documentation
3. Integration with chat system
4. Escalation logic

### Phase 4: Volunteer Support (Weeks 8-9)
1. Volunteer portal
2. Availability system
3. Skill matching
4. Reward distribution

### Phase 5: Full Integration (Week 10)
1. Cross-system search
2. Unified UI
3. Analytics dashboard
4. Performance optimization

## Resource Requirements

### Validator Resources
- **Storage**: +50GB for documentation and forum data
- **Memory**: +2GB for caching and search indices
- **CPU**: Minimal increase (5-10%)
- **Network**: Moderate increase for P2P sync

### Development Resources
- 2-3 developers for 10 weeks
- UI/UX designer for interfaces
- Technical writer for initial documentation
- Community manager for launch

## Success Metrics

1. **Adoption Metrics**
   - 80% of users access documentation monthly
   - 500+ active forum contributors
   - 90% of support queries resolved

2. **Quality Metrics**
   - <30 second documentation load time
   - >90% positive support ratings
   - <1% spam/abuse rate

3. **Decentralization Metrics**
   - Content replicated on 100+ validators
   - No single point of failure
   - 99.9% uptime across network

4. **PoP Impact**
   - 20% of users earn support PoP points
   - Increased validator participation
   - Higher overall engagement

## Risk Mitigation

1. **Spam/Abuse**
   - Stake requirement for posting
   - Reputation-based limits
   - Community moderation
   - Validator consensus for bans

2. **Quality Control**
   - Peer review process
   - Voting mechanisms
   - Expert verification
   - Regular audits

3. **Technical Failures**
   - Redundant storage
   - Graceful degradation
   - Offline capabilities
   - Regular backups

## Reference Implementation Usage

### Learning from Existing Systems

We will study **Retroshare** and **IPFS-Boards** as reference implementations to understand:

1. **From Retroshare (GPL Licensed - Concepts Only)**
   - Offline-first architecture
   - Friend-to-friend trust networks
   - Decentralized moderation consensus
   - Encrypted content storage patterns

2. **From IPFS-Boards (Check License)**
   - Decentralized content addressing
   - P2P content propagation
   - Community governance models
   - Spam resistance techniques

**Important:** We will write all new TypeScript code from scratch, using these projects only for architectural inspiration and algorithm understanding. No code will be copied or directly translated to avoid GPL license obligations.

## Implementation Notes

### Database Schema Design

All data will be stored in YugabyteDB for automatic replication:

```sql
-- Documentation tables
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    version INTEGER DEFAULT 1,
    author_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector,
    INDEX idx_documents_category (category),
    INDEX idx_documents_language (language),
    INDEX idx_documents_search (search_vector)
);

-- Forum tables  
CREATE TABLE forum_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    author_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    INDEX idx_threads_category (category),
    INDEX idx_threads_updated (updated_at DESC)
);

CREATE TABLE forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES forum_threads(id),
    parent_id UUID REFERENCES forum_posts(id),
    author_address VARCHAR(42) NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_accepted_answer BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    INDEX idx_posts_thread (thread_id),
    INDEX idx_posts_author (author_address)
);

-- Support tables
CREATE TABLE support_volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) UNIQUE NOT NULL,
    expertise JSONB NOT NULL, -- ["wallet", "dex", "marketplace"]
    languages JSONB NOT NULL, -- ["en", "es", "zh"]
    is_available BOOLEAN DEFAULT false,
    rating DECIMAL(3,2) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    last_active TIMESTAMP,
    INDEX idx_volunteers_available (is_available)
);

CREATE TABLE support_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address VARCHAR(42) NOT NULL,
    volunteer_address VARCHAR(42) NOT NULL,
    category VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    transcript JSONB,
    pop_points_awarded DECIMAL(10,2),
    INDEX idx_sessions_user (user_address),
    INDEX idx_sessions_volunteer (volunteer_address)
);
```

## Conclusion

This decentralized support system will create a self-sustaining, community-driven knowledge base that aligns perfectly with OmniBazaar's decentralized philosophy. By integrating with the PoP system, we incentivize quality contributions while maintaining complete independence from centralized control.

The system will grow organically with the community, becoming more valuable as more users contribute and participate. This creates a positive feedback loop that strengthens both the support system and the overall OmniBazaar ecosystem.