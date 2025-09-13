/**
 * Documentation Consensus Service
 *
 * Manages validator consensus for official documentation updates.
 * Ensures that critical documentation changes are approved by a majority
 * of validators before being marked as official.
 *
 * @module DocumentationConsensus
 */

import { Database } from '../database/Database';
import { logger } from '../../utils/logger';
import { DocumentUpdateProposal, Document } from './DocumentationService';
import { StakingService } from '../../../../Validator/src/services/StakingService';
import { MasterMerkleEngine } from '../../../../Validator/src/engines/MasterMerkleEngine';

/**
 * Consensus configuration for documentation updates
 */
export interface ConsensusConfig {
  /** Minimum validators required for quorum */
  minValidators: number;
  /** Percentage of votes needed to approve (0-1) */
  approvalThreshold: number;
  /** Voting period duration in milliseconds */
  votingPeriodMs: number;
  /** Minimum stake required to vote */
  minStakeToVote: number;
  /** Grace period after voting ends before execution */
  gracePeriodMs: number;
}

/**
 * Validator vote on a proposal
 */
export interface ValidatorVote {
  /** Proposal being voted on */
  proposalId: string;
  /** Validator's address */
  validatorAddress: string;
  /** Vote decision */
  vote: 'yes' | 'no' | 'abstain';
  /** Optional reason for vote */
  reason?: string;
  /** Timestamp of vote */
  timestamp: Date;
  /** Validator's stake weight */
  stakeWeight: number;
}

/**
 * Consensus result for a proposal
 */
export interface ConsensusResult {
  /** Proposal ID */
  proposalId: string;
  /** Whether consensus was reached */
  consensusReached: boolean;
  /** Final decision */
  decision: 'approved' | 'rejected' | 'no_quorum';
  /** Total votes cast */
  totalVotes: number;
  /** Votes in favor */
  yesVotes: number;
  /** Votes against */
  noVotes: number;
  /** Abstentions */
  abstainVotes: number;
  /** Total stake represented */
  totalStake: number;
  /** Stake voting yes */
  yesStake: number;
  /** Percentage approval */
  approvalPercentage: number;
  /** Execution timestamp if approved */
  executionTime?: Date;
}

/**
 * Default consensus configuration
 */
const DEFAULT_CONFIG: ConsensusConfig = {
  minValidators: 3,
  approvalThreshold: 0.66, // 2/3 majority
  votingPeriodMs: 24 * 60 * 60 * 1000, // 24 hours
  minStakeToVote: 1000, // 1000 XOM
  gracePeriodMs: 2 * 60 * 60 * 1000, // 2 hours
};

/**
 * Documentation Consensus Service
 *
 * @example
 * ```typescript
 * const consensus = new DocumentationConsensus(db);
 * await consensus.initialize();
 *
 * // Submit proposal for official doc update
 * const proposal = await consensus.submitProposal({
 *   documentId: 'doc_123',
 *   newContent: updatedContent,
 *   proposerAddress: validatorAddress
 * });
 *
 * // Cast vote
 * await consensus.vote(proposal.proposalId, validatorAddress, 'yes');
 * ```
 */
export class DocumentationConsensus {
  private stakingService?: StakingService;
  
  /**
   * Creates a new Documentation Consensus instance
   *
   * @param db - Database instance
   * @param config - Consensus configuration
   */
  constructor(
    private db: Database,
    private config: ConsensusConfig = DEFAULT_CONFIG,
  ) {
    // Try to get StakingService from MasterMerkleEngine
    try {
      const masterMerkleEngine = MasterMerkleEngine.getInstance();
      if (masterMerkleEngine && masterMerkleEngine.getServices()) {
        const services = masterMerkleEngine.getServices();
        this.stakingService = services.staking as StakingService;
      }
    } catch (error) {
      // Staking service not available - will use fallback values
      logger.warn('StakingService not available for DocumentationConsensus', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initializes the consensus service
   */
  async initialize(): Promise<void> {
    await this.createConsensusTables();
    logger.info('Documentation Consensus Service initialized');
  }

  /**
   * Submits a proposal for official documentation update
   *
   * @param proposal - Update proposal details
   * @returns Created proposal with ID
   * @throws {Error} If proposer lacks permission
   */
  async submitProposal(
    proposal: Omit<DocumentUpdateProposal, 'proposalId' | 'votes'>,
  ): Promise<DocumentUpdateProposal> {
    try {
      // Validate proposer is a validator
      const isValidator = await this.isValidator(proposal.proposerAddress);
      if (!isValidator) {
        throw new Error('Only validators can propose official documentation updates');
      }

      // Create proposal
      const proposalId = this.generateProposalId();
      const votingEndsAt = new Date(Date.now() + this.config.votingPeriodMs);

      await this.db.query(
        `INSERT INTO documentation_proposals (
          proposal_id, document_id, new_content, new_metadata,
          proposer_address, created_at, voting_ends_at, status
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'voting')`,
        [
          proposalId,
          proposal.documentId,
          proposal.newContent,
          JSON.stringify(proposal.newMetadata),
          proposal.proposerAddress,
          votingEndsAt,
        ],
      );

      logger.info(`Documentation proposal created: ${proposalId}`);

      return {
        ...proposal,
        proposalId,
        status: 'pending' as const,
        createdAt: new Date(),
        expiresAt: votingEndsAt,
        votes: { yes: 0, no: 0, abstain: 0 },
      };
    } catch (error) {
      logger.error('Failed to submit documentation proposal:', error);
      throw error;
    }
  }

  /**
   * Casts a vote on a documentation proposal
   *
   * @param proposalId - Proposal to vote on
   * @param validatorAddress - Voting validator
   * @param vote - Vote decision
   * @param reason - Optional reason for vote
   * @throws {Error} If vote is invalid
   */
  async vote(
    proposalId: string,
    validatorAddress: string,
    vote: 'yes' | 'no' | 'abstain',
    reason?: string,
  ): Promise<void> {
    try {
      // Validate validator
      const validatorInfo = await this.getValidatorInfo(validatorAddress);
      if (validatorInfo === null || validatorInfo.stake < this.config.minStakeToVote) {
        throw new Error('Insufficient stake to vote');
      }

      // Check proposal is still open
      const proposal = await this.getProposal(proposalId);
      if (proposal === null || proposal.status !== 'voting') {
        throw new Error('Proposal is not open for voting');
      }

      // Check if already voted
      const existingVote = await this.db.query(
        'SELECT * FROM documentation_votes WHERE proposal_id = $1 AND validator_address = $2',
        [proposalId, validatorAddress],
      );

      if (existingVote.rows.length > 0) {
        throw new Error('Validator has already voted on this proposal');
      }

      // Record vote
      await this.db.query(
        `INSERT INTO documentation_votes (
          proposal_id, validator_address, vote, reason, stake_weight, timestamp
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [proposalId, validatorAddress, vote, reason, validatorInfo.stake],
      );

      // Check if voting period has ended
      await this.checkVotingComplete(proposalId);

      logger.info(`Vote recorded: ${validatorAddress} voted ${vote} on ${proposalId}`);
    } catch (error) {
      logger.error('Failed to record vote:', error);
      throw error;
    }
  }

  /**
   * Checks if a proposal has reached consensus
   *
   * @param proposalId - Proposal to check
   * @returns Consensus result
   */
  async checkConsensus(proposalId: string): Promise<ConsensusResult> {
    try {
      // Get all votes
      const votes = await this.db.query<{
        proposal_id: string;
        validator_address: string;
        vote: 'yes' | 'no' | 'abstain';
        reason?: string;
        stake_weight: number;
        timestamp: Date;
      }>('SELECT * FROM documentation_votes WHERE proposal_id = $1', [proposalId]);

      // Calculate vote tallies
      let totalVotes = 0;
      let yesVotes = 0;
      let noVotes = 0;
      let abstainVotes = 0;
      let totalStake = 0;
      let yesStake = 0;

      for (const vote of votes.rows) {
        totalVotes++;
        totalStake += vote.stake_weight;

        switch (vote.vote) {
          case 'yes':
            yesVotes++;
            yesStake += vote.stake_weight;
            break;
          case 'no':
            noVotes++;
            break;
          case 'abstain':
            abstainVotes++;
            break;
        }
      }

      // Check quorum
      const hasQuorum = totalVotes >= this.config.minValidators;

      // Calculate approval percentage (stake-weighted)
      const approvalPercentage = totalStake > 0 ? yesStake / totalStake : 0;

      // Determine decision
      let decision: ConsensusResult['decision'] = 'no_quorum';
      if (hasQuorum) {
        decision = approvalPercentage >= this.config.approvalThreshold ? 'approved' : 'rejected';
      }

      const result: ConsensusResult = {
        proposalId,
        consensusReached: hasQuorum && decision !== 'no_quorum',
        decision,
        totalVotes,
        yesVotes,
        noVotes,
        abstainVotes,
        totalStake,
        yesStake,
        approvalPercentage,
      };

      // If approved, schedule execution
      if (decision === 'approved') {
        result.executionTime = new Date(Date.now() + this.config.gracePeriodMs);
      }

      return result;
    } catch (error) {
      logger.error('Failed to check consensus:', error);
      throw error;
    }
  }

  /**
   * Executes an approved proposal
   *
   * @param proposalId - Proposal to execute
   * @returns Updated document
   */
  async executeProposal(proposalId: string): Promise<Document> {
    try {
      // Get proposal
      const proposal = await this.getProposal(proposalId);
      if (proposal === null) {
        throw new Error('Proposal not found');
      }

      // Verify consensus
      const consensus = await this.checkConsensus(proposalId);
      if (consensus.decision !== 'approved') {
        throw new Error('Proposal was not approved');
      }

      // Update proposal status
      await this.db.query(
        'UPDATE documentation_proposals SET status = $1, executed_at = NOW() WHERE proposal_id = $2',
        ['executed', proposalId],
      );

      // The actual document update will be handled by DocumentationService
      logger.info(`Proposal ${proposalId} executed successfully`);

      // Return a placeholder - actual document update happens in DocumentationService
      return {} as Document;
    } catch (error) {
      logger.error('Failed to execute proposal:', error);
      throw error;
    }
  }

  /**
   * Gets active proposals
   *
   * @returns List of active proposals
   */
  async getActiveProposals(): Promise<DocumentUpdateProposal[]> {
    try {
      const proposals = await this.db.query<{
        proposal_id: string;
        document_id: string;
        new_content: string;
        new_metadata: Record<string, unknown>;
        proposer_address: string;
        created_at: Date;
        voting_ends_at: Date;
        status: string;
        yes_votes: string;
        no_votes: string;
        abstain_votes: string;
      }>(
        `SELECT p.*, 
          COUNT(CASE WHEN v.vote = 'yes' THEN 1 END) as yes_votes,
          COUNT(CASE WHEN v.vote = 'no' THEN 1 END) as no_votes,
          COUNT(CASE WHEN v.vote = 'abstain' THEN 1 END) as abstain_votes
         FROM documentation_proposals p
         LEFT JOIN documentation_votes v ON p.proposal_id = v.proposal_id
         WHERE p.status = 'voting' AND p.voting_ends_at > NOW()
         GROUP BY p.proposal_id
         ORDER BY p.created_at DESC`,
      );

      return proposals.rows.map(row => ({
        proposalId: row.proposal_id,
        documentId: row.document_id,
        newContent: row.new_content,
        newMetadata: row.new_metadata,
        proposerAddress: row.proposer_address,
        status: 'pending' as const,
        createdAt: row.created_at,
        expiresAt: row.voting_ends_at,
        votes: {
          yes: parseInt(row.yes_votes),
          no: parseInt(row.no_votes),
          abstain: parseInt(row.abstain_votes),
        },
      }));
    } catch (error) {
      logger.error('Failed to get active proposals:', error);
      return [];
    }
  }

  /**
   * Checks if voting period has ended and finalizes if needed
   * @param proposalId - The proposal to check
   * @private
   */
  private async checkVotingComplete(proposalId: string): Promise<void> {
    const proposal = await this.db.query(
      'SELECT * FROM documentation_proposals WHERE proposal_id = $1 AND voting_ends_at < NOW() AND status = $2',
      [proposalId, 'voting'],
    );

    if (proposal.rows.length > 0) {
      // Voting period ended, finalize
      const consensus = await this.checkConsensus(proposalId);

      await this.db.query(
        'UPDATE documentation_proposals SET status = $1, consensus_result = $2 WHERE proposal_id = $3',
        [
          consensus.decision === 'approved' ? 'approved' : 'rejected',
          JSON.stringify(consensus),
          proposalId,
        ],
      );

      logger.info(`Proposal ${proposalId} finalized with decision: ${consensus.decision}`);
    }
  }

  /**
   * Gets a specific proposal
   * @param proposalId - The proposal ID to retrieve
   * @returns The proposal or null if not found
   * @private
   */
  private async getProposal(proposalId: string): Promise<{
    proposal_id: string;
    document_id: string;
    new_content: string;
    new_metadata: Record<string, unknown>;
    proposer_address: string;
    status: string;
    voting_ends_at: Date;
    created_at: Date;
  } | null> {
    const result = await this.db.query<{
      proposal_id: string;
      document_id: string;
      new_content: string;
      new_metadata: Record<string, unknown>;
      proposer_address: string;
      status: string;
      voting_ends_at: Date;
      created_at: Date;
    }>('SELECT * FROM documentation_proposals WHERE proposal_id = $1', [proposalId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return row ?? null;
  }

  /**
   * Checks if address is a validator
   * @param address - The address to check
   * @returns True if the address is an active validator
   * @private
   */
  private async isValidator(address: string): Promise<boolean> {
    // In production, this would check the validator registry
    // For now, simulate with a simple check
    const result = await this.db.query(
      'SELECT * FROM validators WHERE address = $1 AND is_active = true',
      [address],
    );
    return result.rows.length > 0;
  }

  /**
   * Gets validator information including stake
   * @param address - The validator address
   * @returns Validator info with stake or null if not found
   * @private
   */
  private async getValidatorInfo(address: string): Promise<{ stake: number } | null> {
    const isVal = await this.isValidator(address);
    if (!isVal) {
      return null;
    }
    
    // Try to get real stake from StakingService
    if (this.stakingService) {
      try {
        const stakedAmount = this.stakingService.getStakedAmount(address);
        // Convert bigint to number (safe for reasonable stake amounts)
        return { stake: Number(stakedAmount) };
      } catch (error) {
        logger.warn('Failed to get stake from StakingService', {
          address,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Fallback to default stake value if service not available
    return { stake: 10000 };
  }

  /**
   * Generates unique proposal ID
   * @returns Generated proposal ID
   * @private
   */
  private generateProposalId(): string {
    return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Creates necessary database tables
   * @private
   */
  private async createConsensusTables(): Promise<void> {
    // Documentation proposals table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS documentation_proposals (
        proposal_id VARCHAR(100) PRIMARY KEY,
        document_id VARCHAR(100) NOT NULL,
        new_content TEXT NOT NULL,
        new_metadata JSONB,
        proposer_address VARCHAR(42) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        voting_ends_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'voting',
        consensus_result JSONB,
        executed_at TIMESTAMP,
        INDEX idx_proposals_status (status),
        INDEX idx_proposals_voting_ends (voting_ends_at)
      )
    `);

    // Documentation votes table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS documentation_votes (
        proposal_id VARCHAR(100) REFERENCES documentation_proposals(proposal_id),
        validator_address VARCHAR(42) NOT NULL,
        vote VARCHAR(10) NOT NULL,
        reason TEXT,
        stake_weight INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (proposal_id, validator_address),
        INDEX idx_votes_proposal (proposal_id)
      )
    `);

    // Validators table (simplified for documentation module)
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS validators (
        address VARCHAR(42) PRIMARY KEY,
        is_active BOOLEAN DEFAULT true,
        stake INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
}
