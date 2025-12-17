# Meta-Tools Refactor Project

## Overview

Refactoring the HubSpot MCP from 12+ domain-specific tools to a two-tool architecture:
- `getTools` - Discovery tool for fetching operation-specific schemas
- `useTools` - Execution wrapper for validated tool calls

## Problem Statement

Current architecture exposes unified schemas per domain where all parameters are optional. This causes:
1. Claude doesn't know which params are required for which operation
2. Confusing validation errors after the call
3. Schema mismatch between what's exposed and what handlers expect
4. Cognitive overload with 12+ large tool schemas

## Proposed Solution

### Tool 1: `getTools`
- Shows lightweight catalog of available domains and operations in description
- Accepts requests for specific domain/operation pairs
- Returns precise schemas with correct required/optional fields

### Tool 2: `useTools`
- Accepts domain, operation, and params
- Server-side validation against real schema
- Executes the operation and returns results
- Provides helpful, contextual error messages

## Benefits
- Reduced cognitive load for Claude
- Accurate required/optional fields per operation
- Server-side validation with helpful errors
- Cleaner MCP surface (2 tools vs 12+)
- Extensible without bloating interface

## Project Phases

### Phase 1: Prepare ✅ COMPLETE
- ✅ Document current tool registration flow
- ✅ Map all domains, operations, and their actual required params
- ✅ Understand how schemas are currently generated
- **Output:** `/docs/preparation/meta-tools-current-architecture.md`

### Phase 2: Architect ✅ COMPLETE
- ✅ Design hubspot_getTools schema and response format
- ✅ Design hubspot_useTools schema and validation flow
- ✅ Design SchemaRegistry class for runtime schema discovery
- ✅ Plan migration path from current system (parallel deployment)
- ✅ Design context provider integration strategy
- ✅ Create comprehensive implementation plan
- **Output:** `/docs/architecture/meta-tools-design.md`

### Phase 3: Code ✅ COMPLETE
- ✅ Create SchemaRegistry class (`/src/core/schema-registry.ts` - 409 LOC)
- ✅ Create MetaToolsHandler (`/src/core/meta-tools-handler.ts` - 282 LOC)
- ✅ Create MetaToolsRegistrationFactory (`/src/core/meta-tools-factory.ts` - 126 LOC)
- ✅ Update types.ts with new interfaces (DomainSummary, OperationSummary, etc.)
- ✅ Update http-server-sdk.ts with USE_META_TOOLS feature flag
- ✅ Build verification successful

### Phase 4: Test (READY TO START)
- [ ] Unit tests for SchemaRegistry
- [ ] Unit tests for MetaToolsHandler
- [ ] Integration tests for all 72 operations
- [ ] Performance tests (caching, latency)
- [ ] End-to-end validation testing

## Progress Log

### Session 1 - Initial Planning
- Identified schema mismatch issues in Associations, Properties, and other domains
- Decided on meta-tools architecture as the solution
- Created this project document

### Session 2 - Preparation Phase (2025-12-17)
- Completed comprehensive analysis of current architecture
- Documented all 12 domains with 72 operations
- Identified schema mismatches between factory and BCP tools
- Analyzed context/goals parameter handling
- Mapped operation name conventions
- Created 1,123-line preparation document

### Session 3 - Architecture Phase (2025-12-17)
- Designed complete meta-tools architecture
- Specified hubspot_getTools with 3 discovery modes
- Specified hubspot_useTools with comprehensive validation
- Designed SchemaRegistry with runtime schema extraction
- Planned context provider integration (deal stages, property groups, blogs)
- Created 5-day implementation plan
- Designed parallel deployment migration strategy
- Documented 5 complete example flows
- Created comprehensive error handling matrix
- Defined success criteria and risk mitigation
- Architecture document: 1,100+ lines with complete specifications

### Session 4 - Code Phase (2025-12-17)
- Implemented SchemaRegistry with runtime schema extraction from BCP tools
- Implemented meta-tools handlers (getTools with 3 discovery modes, useTools with validation)
- Created MetaToolsRegistrationFactory with Zod schema definitions
- Initial implementation with feature flag for parallel deployment

### Session 5 - Cleanup Phase (2025-12-17)
- **Removed feature flag** - meta-tools is now the ONLY architecture
- **Deleted legacy code**: `src/core/tool-registration-factory.ts` (12 domain tools)
- **Cleaned up imports** in http-server-sdk.ts
- **Updated comments** across affected files
- Server now exposes exactly 2 tools: `hubspot_getTools` and `hubspot_useTools`
- Build verification: TypeScript compilation successful
