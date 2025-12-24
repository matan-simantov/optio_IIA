-- XRL Database Schema
-- SQL schema for sessions and VUKs tables
-- Note: This is a reference schema. Actual implementation may vary based on database choice.

-- Sessions table
-- Stores session data matching session_schema_v1.json structure
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version VARCHAR(10) NOT NULL DEFAULT 'v1',
    status VARCHAR(50) NOT NULL DEFAULT 'initialized',
    
    -- Raw input
    initial_description TEXT,
    source VARCHAR(50) DEFAULT 'web',
    
    -- Onboarding answers
    scientific_basis TEXT,
    primary_applications TEXT,
    secondary_applications TEXT,
    exclusions TEXT,
    example_entities JSON,
    deployment_layer VARCHAR(255),
    strategic_focus JSON,
    
    -- Classification
    taxonomy_l1 VARCHAR(255),
    taxonomy_l2 VARCHAR(255),
    taxonomy_l3 VARCHAR(255),
    taxonomy_node_id VARCHAR(255),
    taxonomy_candidates JSON,
    
    -- Artifacts (stored as JSON)
    mapping_profile JSON,
    weights JSON,
    datasets JSON,
    metrics JSON,
    scores JSON,
    
    -- Logs (stored as JSON array)
    logs JSON,
    
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VUKs (Validated Units of Knowledge) table
-- Stores VUK data matching vuk_schema_v1.json structure
CREATE TABLE IF NOT EXISTS vuks (
    vuk_id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    schema_version VARCHAR(10) NOT NULL DEFAULT 'v1',
    created_from_session_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    
    -- Technology information
    technology_name VARCHAR(255),
    technology_one_liner TEXT,
    technology_description TEXT,
    technology_keywords JSON,
    technology_exclusions JSON,
    
    -- Taxonomy
    taxonomy_l1 VARCHAR(255),
    taxonomy_l2 VARCHAR(255),
    taxonomy_l3 VARCHAR(255),
    taxonomy_node_id VARCHAR(255),
    
    -- TRL (Technology Readiness Level)
    trl_value INT,
    trl_rationale TEXT,
    trl_evidence_refs JSON,
    
    -- Mapping and scores
    mapping_profile_ref VARCHAR(255),
    scores JSON,
    
    -- Confidence
    confidence_value DECIMAL(5,2),
    confidence_rationale TEXT,
    
    -- Audit
    approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP NULL,
    
    -- Logs (stored as JSON array)
    logs JSON,
    
    FOREIGN KEY (created_from_session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_created_from_session (created_from_session_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

