# OmniBazaar — infraBUIDL() Grant Application

**Form URL:** <https://build.avax.network/grants/infrabuidl>
**Prepared:** April 7, 2026

Instructions: Copy each answer below into the corresponding field on the form.
Fields marked [DROPDOWN] require selecting from the form's dropdown.
Fields marked [YOU DECIDE] need your input — I've provided a recommendation.

---

## ═══════════════════════════════════════════

## SECTION 1: PROJECT OVERVIEW

## ═══════════════════════════════════════════

### 1. Project/Company Name

```
OmniBazaar
```

### 2. Project Type [DROPDOWN — select multiple if allowed]

```
Primary: Wallets
Also applicable: Bridges, Data Storage, Indexers, Oracles, Token Engineering, Interoperability Tools
```

> **[YOU DECIDE]:** If you can only pick ONE, choose **"Wallets"** or **"Other"** (since you span many categories). If multiple selections are allowed, pick all that apply.

### 3. Project Abstract and Objective

```
OmniBazaar is a fully decentralized marketplace platform ALREADY LIVE on Avalanche L1 (Chain 88008), with 90 deployed smart contracts, 5 active validators, and 4,735 users with on-chain balances. The platform unifies P2P marketplace, high-performance DEX, 128-blockchain wallet, RWA trading, yield products, prediction markets, and encrypted chat — powered by a Proof of Participation validator network with zero gas fees for users. Development is complete. We are launching publicly this month (April 2026) and applying for this grant primarily to seed liquidity on C-Chain and accelerate ecosystem growth.

WHAT'S ALREADY BUILT AND DEPLOYED (verifiable on-chain today):
- 90 smart contracts on Chain 88008 (63 unique), 156 Solidity tests passing, 7-pass security audit
- 5 validator nodes running Snowman consensus on dedicated servers (1-2s finality)
- ICTT bridge deployed: ERC20TokenHome on C-Chain (0x79B7...9ded), ERC20TokenRemote on L1 (0x81f4...219C)
- Hybrid DEX (order book + custom RWAAMM) with MEV protection, circuit breakers, 10K+ orders/sec
- 128-blockchain wallet with Ledger/Trezor hardware support
- LiquidityOverflowPool routing ~$890K/year of validator block reward overflow to LPs (organic yield, not inflationary)
- 5,000+ RWA listings, 17,000+ yield products, 156,000+ prediction markets indexed
- 6 bridge protocols integrated (ICTT, LayerZero, CCIP, Wormhole, CCTP V2, Avalanche Bridge)
- Privacy trading via COTI V2 (XOM <-> pXOM)
- IPFS storage network (67K+ assets pinned), YugabyteDB cluster, WireGuard VPN mesh
- 12-language internationalization

WHAT WE NEED THE GRANT FOR:
This is a liquidity and growth grant, not a development grant. The code is done. We need capital to:
1. Seed the XOM/AVAX pool on LFJ (Trader Joe) on C-Chain — creating the first public trading venue for XOM and driving cross-chain liquidity flow via ICTT.
2. Bootstrap TVL in the LiquidityOverflowPool to activate the organic yield flywheel (~$890K/year from block reward overflow attracts LPs, which deepens markets, which attracts users).
3. Fund validator network expansion from 5 to 20+ nodes, exchange listings, and marketing for public launch.

HOW THIS ENHANCES AVALANCHE:
Every marketplace transaction, DEX trade, bridge transfer, and staking operation settles on Avalanche infrastructure. The ICTT bridge creates direct liquidity flow between our L1 and C-Chain — XOM trading on LFJ brings new volume to C-Chain DEXs. We will open-source 4 production-tested infrastructure components for other L1 builders: multi-protocol bridge aggregator, RWAAMM with circuit breakers, Proof of Participation validator scoring, and LiquidityOverflowPool. The zero-gas-fee model showcases Subnet-EVM's custom gas economics for real-world commerce — not just DeFi primitives.
```

### 4. Technical Roadmap

```
ALREADY COMPLETED (2024 — April 2026):
- Avalanche L1 deployed and operational (Chain 88008, Snowman consensus, 1-2s finality)
- 90 smart contracts deployed (63 unique), all audited, 156 Solidity tests passing
- 5 validator nodes on dedicated Hetzner servers with WireGuard VPN mesh and auto-restart
- 4,735 users migrated from legacy platform with on-chain XOM balances
- Hybrid DEX: order book + custom RWAAMM with MEV protection, circuit breakers, EmergencyGuardian
- 128-blockchain wallet with BIP39 HD derivation, Ledger/Trezor hardware support
- ICTT bridge contracts deployed on both C-Chain and L1 (Teleporter registry configured)
- 6 bridge protocols integrated (ICTT, LayerZero, CCIP, Wormhole, CCTP V2, Avalanche Bridge)
- LiquidityOverflowPool + LPZap deployed and audited (86 tests, 7-pass audit, all findings remediated)
- IPFS storage network (Kubo 0.27.0, DHT routing, 67K+ assets pinned)
- YugabyteDB distributed database across 5 validators
- COTI V2 privacy integration (XOM <-> pXOM, PrivateDEXSettlement)
- 12-language internationalization
- Self-sovereign oracle: 1,802 RWA price feeds, 948 confirmed live
- Trustless authentication: challenge-response login, password never leaves browser

IN PROGRESS — April 2026 (soft launch week):
- Soft launch of WebApp + Validator platform (week of April 7)
- ICTT bridge activation for live XOM transfers
- LiquidityOverflowPool seeding and reward activation

PHASE 1 — Hard Launch & C-Chain Liquidity (May 2026):
Start: May 1, 2026 | End: May 31, 2026
- Hard launch: platform publicly accessible with full onboarding flow
- Seed XOM/AVAX pool on LFJ (Trader Joe) on C-Chain
- Submit DefiLlama TVL adapter for OmniBazaar L1 tracking
- Open-source the Coin module (30+ Solidity contracts) on GitHub
- Key Activities: Liquidity seeding (primary), public launch marketing, DefiLlama integration

PHASE 2 — Wallet Extension, Mobile App & Growth (June-July 2026):
Start: June 1, 2026 | End: July 15, 2026
- Release Wallet browser extension (128 chains, hardware wallet support)
- Release mobile app beta (iOS + Android)
- Scale to 10+ validators via Proof of Participation onboarding
- Achieve $500K+ TVL, 2,000+ users
- Apply for CoinGecko and CoinMarketCap listings
- Key Activities: Extension/mobile release, validator recruitment, liquidity growth

PHASE 3 — Ecosystem Scale & Open-Source (August-September 2026):
Start: August 1, 2026 | End: September 30, 2026
- Open-source infrastructure: bridge aggregator, RWAAMM, Proof of Participation, LiquidityOverflowPool
- Expand to 20+ validators
- Cross-chain marketplace fully operational (buy/sell across L1 and C-Chain)
- Scale to 5,000+ users and $2M+ TVL
- Developer documentation and integration guides published
- Key Activities: Open-source release, validator expansion, cross-chain commerce, documentation
```

### 5. Repositories and Achievements

```
REPOSITORIES:
- OmniBazaar platform (private, 5 modules): Validator, WebApp, Wallet, Coin (Solidity), DEX
- Smart contracts: 63 unique contracts deployed on Chain 88008, including OmniCoin (XOM), OmniCore, DEXSettlement V2, RWAAMM, LiquidityOverflowPool, EmergencyGuardian, RWAComplianceOracle, OmniBridge, and 50+ more
- GitHub will be made public as part of Milestone 4 open-source release

BLOCKCHAIN ACHIEVEMENTS:
- Deployed and operating a production Avalanche L1 (Chain 88008) with 5 validator nodes since 2025
- 90 smart contracts deployed on-chain (63 unique + implementations + legacy versions)
- 156 Solidity tests passing, 232 validator service tests passing (99.6%)
- Custom RWAAMM (Resilient Weighted AMM) with EmergencyGuardian circuit breakers — 86 LP-specific tests, 7-pass security audit
- ICTT bridge integration: ERC20TokenHome on C-Chain (0x79B7480feEb8fD4509993c78ef8DdE9786Fc9ded), ERC20TokenRemote on L1 (0x81f4072fCca24d373FFCB34c248995DFC6c1219C)
- Novel Proof of Participation scoring system (100-point scale combining KYC, reputation, staking, referrals, activity, reliability)
- LiquidityOverflowPool: routes ~222.5M XOM/year (~$890K) of validator block reward overflow to LPs — organic yield without inflationary emissions
- 128-blockchain wallet with BIP39 HD derivation, hardware wallet support (Ledger/Trezor), secure memory wipe
- Self-sovereign oracle aggregation: 1,802 RWA price feeds, 948 confirmed live
- COTI V2 privacy integration: XOM <-> pXOM conversions, PrivateDEXSettlement
- 4,735 users with on-chain balances migrated from legacy OmniBazaar platform
- DEX engine capable of 10,000+ orders/sec with MEV protection

PRIOR EXPERIENCE:
- Richard Crites: 30+ years as executive/entrepreneur, two profitable exits, MS Aerospace Engineering (Stanford), designed the OmniBazaar system architecture
- Team has been building OmniBazaar since 2014 (legacy version), Avalanche L1 migration completed 2025-2026
```

### 6. Risks and Challenges

```
TECHNICAL RISKS:
- Bridge Security (Low likelihood): ICTT uses native Avalanche Warp Messaging (no third-party trust assumptions). All bridge contracts are audited. EmergencyGuardian circuit breakers can pause operations within one block. Contingency: multi-sig pause capability, daily bridge transfer limits during initial launch period.
- Smart Contract Vulnerabilities (Low): 90 contracts deployed with 156 passing tests and 7-pass security audit on LP system. Contingency: EmergencyGuardian can pause RWAAMM; all contracts use OpenZeppelin standards; bug bounty program planned.
- Validator Liveness (Low): 5 dedicated Hetzner servers with systemd auto-restart, WireGuard VPN mesh, 80% quorum threshold. Contingency: validator network expansion to 20+ nodes provides redundancy; automated failover and monitoring.

REGULATORY RISKS:
- Compliance (Medium likelihood): Fully decentralized architecture with no single operator controlling contracts or funds. 4-tier KYC with AML/PEP screening at Tier 2. Proof of Participation model ensures validators are verified community members, strengthening FATF/MiCA decentralized exemption. Contingency: legal counsel (Schohaib Mehran, 15+ years compliance experience) continuously monitors regulatory developments; geo-fencing capabilities built into platform.

MARKET RISKS:
- Low Initial Liquidity (Medium): LiquidityOverflowPool provides ~$890K/year organic yield from validator block reward overflow (not token minting). Early LPs earn premium APR. ICTT bridge enables liquidity flow from C-Chain. Contingency: seed liquidity from project treasury; partnership with LFJ (Trader Joe) for initial pool.
- User Adoption (Medium): 4,735 existing users from legacy platform provide initial user base. 156,000+ prediction market listings and 5,000+ RWA listings provide immediate content. Competitive yield program and zero gas fees lower adoption barriers. Contingency: referral bonus program (decreasing curve, up to 2,500 XOM per referral); marketing campaign targeting existing Avalanche users.
- Competition (Low-Medium): No competitor offers unified marketplace + DEX + wallet + RWA + yield + predictions + chat. Platform effects create high switching costs once users are onboarded. Contingency: focus on unique value proposition (all-in-one platform); leverage privacy features (COTI V2) as differentiator.
```

### 7. Project/Company Website

```
https://omnibazaar.com
```

### 8. Project/Company X Handle

```
@OmniBazaar
```

### 9. Project/Company GitHub

```
https://github.com/AhmedSoliman/OmniBazaar
```

> **[YOU DECIDE]:** Replace with your actual GitHub org URL. If the repo is private, note that it will be open-sourced in Milestone 4.

### 10. Company Type [DROPDOWN]

```
Private Company
```

### 11. Project/Company HQ Country [DROPDOWN]

```
Panama
```

> **[YOU DECIDE]:** Select Panama (based on your +507 phone number) or wherever OmniBazaar is registered.

### 12. Project/Company Continent [DROPDOWN]

```
Central America / Americas
```

> **[YOU DECIDE]:** Select whichever option matches. Likely "Americas" or "Central America" or "South America" depending on how they categorize it.

### 13. Media Kit (Google Drive link)

```
```

> **[YOU DECIDE]:** Create a Google Drive folder with OmniBazaar logos, brand guidelines, and the YouTube video thumbnail. Share with "anyone with the link" and paste the URL here. You can also include: the investor deck (tinyurl.com/obdeck1), the 60-second video thumbnail, and screenshots.

---

## ═══════════════════════════════════════════

## SECTION 2: FINANCIAL OVERVIEW

## ═══════════════════════════════════════════

### 14. Previous Funding [DROPDOWN]

```
Self-Funding
```

### 15. Previous Avalanche Funding/Grants [DROPDOWN]

```
No previous funding
```

---

## ═══════════════════════════════════════════

## SECTION 3: GRANT BUDGET STRUCTURE & MILESTONES

## ═══════════════════════════════════════════

### 16. Requested Funding Range [DROPDOWN]

```
$100K - $250K (or whichever range includes $150,000)
```

> **[YOU DECIDE]:** Select the range that contains $150,000. Common ranges are $50K-$100K, $100K-$250K, $250K-$500K. If $100K-$150K is an option, choose that.

---

### MILESTONE 1 (Required — Upfront ~20%): ALREADY DELIVERED

**Milestone Name:**

```
Platform Development & Mainnet Deployment (Completed)
```

**Description:**

```
[ALREADY COMPLETED — requesting retroactive recognition.] OmniBazaar has been self-funded and in development for over 2 years. The platform is live on Avalanche L1 (Chain 88008) with 90 deployed smart contracts (63 unique), 5 active validator nodes running Snowman consensus, 4,735 registered users with on-chain balances, and a 7-pass security audit completed. All infrastructure is verifiable on-chain today. Key completed components: hybrid DEX (order book + RWAAMM), 128-blockchain wallet, ICTT bridge contracts deployed on both C-Chain and L1, IPFS storage network with 67K+ pinned assets, LiquidityOverflowPool with audited reward distribution, 6-protocol bridge aggregator, COTI V2 privacy integration, and 12-language internationalization. Soft launch begins the week of April 7, 2026.
```

**Deliverables & Success Metrics/KPIs:**

```
Deliverables (all verifiable on-chain today):
- 90 smart contracts deployed on Chain 88008 (verifiable via block explorer)
- 5 active validator nodes with Snowman consensus producing blocks
- ICTT bridge contracts deployed: ERC20TokenHome on C-Chain (0x79B7...9ded), ERC20TokenRemote on L1 (0x81f4...219C)
- RWAAMM + LiquidityOverflowPool deployed and audited (86 tests, 7-pass audit)
- 4,735 registered users with on-chain XOM balances
- 156 Solidity tests passing, 232 validator service tests passing

Success Metrics (already achieved):
- Chain 88008 live and producing blocks with 1-2s finality
- 63 unique production smart contracts deployed and operational
- 5 validator nodes maintaining >99% uptime
- 156,000+ prediction market listings, 5,000+ RWA listings, 17,000+ yield products indexed
- Security audit completed with all findings remediated
```

**Estimated Completion Date:**

```
2026-04-07
```

> Already completed. Set to today's date or the earliest date the form allows.

**Amount Requested:**

```
30000
```

---

### MILESTONE 2 (Required)

**Milestone Name:**

```
C-Chain Liquidity & Public Hard Launch
```

**Description:**

```
Seed XOM liquidity on Avalanche C-Chain to enable public trading and cross-chain capital flow. Deploy XOM/AVAX pool on LFJ (Trader Joe). Activate ICTT bridge for live bidirectional XOM transfers. Submit DefiLlama TVL adapter. Execute hard launch of the full platform (WebApp + Validator) with public onboarding. Release Coin (Solidity) module as open source. The majority of this milestone's funding goes directly into LP pool seeding — the development is already done.
```

**Deliverables & Success Metrics/KPIs:**

```
Deliverables:
- XOM/AVAX trading pair live on LFJ (Trader Joe) on C-Chain with seeded liquidity
- ICTT bridge activated for public bidirectional XOM transfers (L1 <-> C-Chain)
- DefiLlama TVL adapter published and tracking OmniBazaar L1
- Hard launch completed: platform publicly accessible with user onboarding flow
- Coin module (30+ Solidity contracts) open-sourced on GitHub

Success Metrics:
- $100K+ liquidity seeded in XOM/AVAX pool on LFJ
- 500+ ICTT bridge transfers between L1 and C-Chain
- OmniBazaar L1 TVL visible and tracked on DefiLlama
- 500+ new user registrations in first month post-launch
- Coin repository public on GitHub with documentation
```

**Estimated Completion Date:**

```
2026-05-31
```

**Amount Requested:**

```
50000
```

---

### MILESTONE 3 (Optional)

**Milestone Name:**

```
Wallet Extension, Mobile App & Liquidity Growth
```

**Description:**

```
Release the OmniBazaar Wallet browser extension (128-blockchain support, Ledger/Trezor) and mobile app beta (iOS/Android). Scale C-Chain liquidity and on-chain TVL through LiquidityOverflowPool reward distribution (~$890K/year organic yield from block reward overflow). Begin validator network expansion beyond the initial 5 nodes. Apply for CoinGecko and CoinMarketCap listings.
```

**Deliverables & Success Metrics/KPIs:**

```
Deliverables:
- Wallet browser extension published (Chrome Web Store / Firefox Add-ons)
- Mobile app beta released (iOS TestFlight + Android APK/Play Store beta)
- LiquidityOverflowPool actively distributing rewards to LPs
- 10+ community validators onboarded via Proof of Participation system
- CoinGecko and CoinMarketCap listing applications submitted

Success Metrics:
- 1,000+ wallet extension installs
- 500+ mobile app beta users
- $500K+ total TVL across L1 and C-Chain pools
- 10+ active validators (up from 5)
- 2,000+ total registered users with on-chain activity
```

**Estimated Completion Date:**

```
2026-07-15
```

**Amount Requested:**

```
40000
```

---

### MILESTONE 4 (Optional)

**Milestone Name:**

```
Ecosystem Scale & Open-Source Infrastructure Release
```

**Description:**

```
Scale to meaningful Avalanche ecosystem metrics. Open-source remaining infrastructure components (bridge aggregator, RWAAMM, Proof of Participation system, LiquidityOverflowPool) for other Avalanche L1 builders. Expand validator network to 20+ nodes. Achieve sustained cross-chain commerce between L1 and C-Chain. Publish developer documentation and integration guides.
```

**Deliverables & Success Metrics/KPIs:**

```
Deliverables:
- Open-source repositories published: bridge aggregator (6 protocols), RWAAMM + EmergencyGuardian, Proof of Participation scoring, LiquidityOverflowPool
- Developer documentation and integration guides for each component
- 20+ active validator nodes
- Cross-chain marketplace fully operational (buy/sell across L1 and C-Chain via ICTT)
- XOM listed on CoinGecko with verified market data

Success Metrics:
- 5,000+ registered users with on-chain activity
- $2M+ total TVL across all pools
- 20+ active validators verified through Proof of Participation
- 4 open-source infrastructure repos published with documentation
- 1,000+ monthly cross-chain bridge transfers via ICTT
```

**Estimated Completion Date:**

```
2026-09-30
```

**Amount Requested:**

```
30000
```

---

### 17. Support with VC fundraising? [DROPDOWN]

```
Yes
```

### 18. Aethir Ecosystem Fund consideration? [DROPDOWN]

```
No
```

> **[YOU DECIDE]:** Select "No" unless you want computational resources for AI/gaming. OmniBazaar doesn't have a significant AI component.

---

## ═══════════════════════════════════════════

## SECTION 4: CONTRIBUTION TO AVALANCHE ECOSYSTEM

## ═══════════════════════════════════════════

### 19. Current Development Stage [DROPDOWN]

```
Late-Stage (product live with onchain metrics)
```

### 20. Duration working on the project [DROPDOWN]

```
2+ years
```

### 21. Project live status [DROPDOWN]

```
Live on Mainnet
```

### 22. Is your project multichain? [RADIO]

```
Yes
```

### 23. First time building on Avalanche? [RADIO]

```
No
```

### 24. Contribution to the Avalanche Ecosystem

```
OmniBazaar is not a future promise — it's a live, production Avalanche L1 that is launching publicly this month. Here's how we contribute to the ecosystem:

1. IMMEDIATE ON-CHAIN ACTIVITY: OmniBazaar is live on Chain 88008 with 90 deployed contracts and 5 validators producing blocks today. Every marketplace transaction, DEX trade, bridge transfer, and staking operation settles on Avalanche. With 156,000+ prediction markets, 5,000+ RWA listings, and 17,000+ yield products already indexed, on-chain activity scales immediately with user growth.

2. C-CHAIN LIQUIDITY VIA ICTT: The ICTT bridge is deployed (ERC20TokenHome on C-Chain, ERC20TokenRemote on L1). Once we seed the XOM/AVAX pool on LFJ (Trader Joe), every bridge transfer uses Avalanche's native AWM/Teleporter — demonstrating production ICTT usage. This brings new trading volume and a new token to C-Chain DEXs.

3. OPEN-SOURCE INFRASTRUCTURE (by Sept 2026): We will release 4 production-tested, audited components for other Avalanche L1 builders:
   - Multi-protocol bridge aggregator (6 protocols including ICTT)
   - RWAAMM + EmergencyGuardian (custom AMM with circuit breakers)
   - Proof of Participation scoring (compliance-aware validator selection)
   - LiquidityOverflowPool (organic yield from block reward overflow)

4. USER ONBOARDING: Zero gas fees + all-in-one platform (marketplace, DEX, wallet, chat) lowers the barrier for non-crypto users to enter Avalanche. The 128-chain wallet puts Avalanche alongside Bitcoin, Solana, and Polkadot — increasing Avalanche's visibility.

EXPECTED OUTCOMES (within 6 months of grant):
- 5,000+ new unique wallets on Avalanche (L1 + C-Chain)
- $2M+ TVL on Avalanche (L1 pools + C-Chain XOM/AVAX pool)
- 20+ new validator nodes running avalanchego
- 1,000+ monthly ICTT bridge transfers between L1 and C-Chain
- 4 open-source infrastructure repos available to the Avalanche builder community
- XOM listed on CoinGecko/CMC, contributing to Avalanche ecosystem metrics
- Wallet extension and mobile app bringing Avalanche L1 access to Chrome/Firefox/iOS/Android
```

### 25. Would existing Avalanche projects benefit? [RADIO]

```
Yes
```

### 26. Are there similar Web2/Web3 projects? [RADIO]

```
Yes
```

> (Web2: eBay/Amazon for marketplace; Web3: OpenSea, dYdX, Polymarket — but none combines all functions)

### 27. Does your project have direct competitors? [RADIO]

```
No
```

> (No direct competitor combines marketplace + DEX + wallet + RWA + yield + predictions + chat on a single L1)

### 28. Plan to launch token on Avalanche? [RADIO]

```
Yes
```

> (XOM is already live on Chain 88008; will also be on C-Chain via ICTT bridge)

### 29. Is your project open source? [DROPDOWN]

```
Partially (currently private; Milestone 4 includes full open-source release of key components)
```

> **[YOU DECIDE]:** If options are "Yes / No / Partially", select "Partially". If only "Yes / No", select "No" with a note that open-sourcing is planned.

---

## ═══════════════════════════════════════════

## SECTION 5: APPLICANT INFORMATION

## ═══════════════════════════════════════════

### 30. Applicant First Name

```
Richard
```

### 31. Applicant Last Name

```
Crites
```

### 32. Applicant Email

```
CEO@OmniBazaar.com
```

### 33. Applicant Job Title [DROPDOWN]

```
CEO / Founder
```

> **[YOU DECIDE]:** Select "CEO", "Founder", or "CEO & Founder" — whichever option is available.

### 34. Applicant Bio

```
Over 30 years as an executive and entrepreneur with two profitable exits. System designer and technical architect of the OmniBazaar decentralized marketplace platform, which has been in development since 2014. Led the migration from a legacy C++ platform to an Avalanche L1 with 90 deployed smart contracts and 5 active validator nodes. MS Aerospace Engineering, Stanford University.
```

### 35. Country of Residence [DROPDOWN]

```
Panama
```

> **[YOU DECIDE]:** Select your actual country of residence.

### 36. University Affiliation? [RADIO]

```
No
```

### 37. X Account

```
https://x.com/OmniBazaar
```

### 38. Telegram

```
```

> **[YOU DECIDE]:** Add your Telegram handle if you have one.

### 39. LinkedIn

```
https://www.linkedin.com/in/rickcrites
```

### 40. GitHub

```
```

> **[YOU DECIDE]:** Add your personal GitHub profile URL.

### 41. Other Resource(s)

```
OmniBazaar in 60 seconds: http://youtu.be/Emq7drTI_Qc | Investor deck: https://tinyurl.com/obdeck1 | Whitepaper (16 languages): http://whitepaper.omnibazaar.com | Pioneer app: https://pioneer.omnibazaar.com | Calendly: https://calendly.com/omnibazaar/30-minute-meeting-zoom
```

---

## ═══════════════════════════════════════════

## SECTION 6: TEAM DETAILS

## ═══════════════════════════════════════════

### 42. Team Size [DROPDOWN]

```
2-5
```

### 43. Is your team willing to KYB? [RADIO]

```
Yes
```

### 44. How did you hear about the Grant Program? [DROPDOWN]

```
```

> **[YOU DECIDE]:** Select the most appropriate option (Website, Twitter/X, Forum, Friend/Referral, etc.)

### 45. Did someone specific refer you? [RADIO]

```
No
```

> **[YOU DECIDE]:** Select "Yes" if someone from Avalanche Foundation referred you.

### 46. Privacy Policy Consent [CHECKBOX]

```
✅ Check this box
```

### 47. Marketing Communications Opt-in [CHECKBOX]

```
✅ Check this box (recommended)
```

---

## ═══════════════════════════════════════════

## BUDGET SUMMARY

## ═══════════════════════════════════════════

| Milestone | Amount | Cumulative | Timeline |
|-----------|--------|-----------|----------|
| M1: Platform Development & Mainnet Deployment **(COMPLETED)** | $30,000 | $30,000 | Already done |
| M2: C-Chain Liquidity & Public Hard Launch | $50,000 | $80,000 | May 2026 |
| M3: Wallet Extension, Mobile App & Liquidity Growth | $40,000 | $120,000 | July 2026 |
| M4: Ecosystem Scale & Open-Source Infrastructure Release | $30,000 | $150,000 | Sept 2026 |
| **TOTAL** | **$150,000** | | **6 months (M1 already done)** |

**Key point:** M1 is retroactive — the work is already verifiable on-chain. M2-M4 span only 5 months (May-Sept 2026). The majority of M2 funding ($50K) goes directly into LP pool seeding on C-Chain, not development.
