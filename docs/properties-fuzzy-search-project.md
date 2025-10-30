# Properties Fuzzy Search Project

**Project Goal**: Implement a fuzzy search solution for HubSpot properties that minimizes context window usage while providing intelligent property discovery.

**Status**: Architecture Phase Complete
**Started**: October 30, 2025
**Expected Completion**: 1 day implementation

---

## Project Overview

### Problem Statement

The current `listProperties` tool returns ALL properties for a given object type (200-500+ properties), consuming 15,000+ tokens of LLM context window space. Users need a way to find specific properties without overwhelming the context.

### Solution

Implement a new `searchProperties` tool that:
- Performs fuzzy matching on the backend
- Returns only top N relevant results (default: 15)
- Uses intelligent scoring to rank matches
- Implements caching to avoid repeated API calls

---

## PACT Progress

### Phase 0: Folder Creation
**Status**: ✅ Complete

- Documentation folder structure already exists
- All necessary folders are in place

### Phase 1: Prepare
**Status**: ✅ Complete

**Documents Created**:
- `/docs/preparation/properties-api-filtering-research.md` - Research on HubSpot Properties API limitations

**Key Findings**:
- HubSpot API returns ALL properties (no search, pagination, or limiting)
- Only `archived` and `dataSensitivity` parameters available
- Client-side filtering is required for any search functionality
- Typical accounts have 200-500+ properties per object type

### Phase 2: Architect
**Status**: ✅ Complete (October 30, 2025)

**Documents Created**:
- `/docs/architecture/properties-fuzzy-search-design.md` - Comprehensive architectural design

**Design Decisions**:

| Decision Area | Chosen Approach | Rationale |
|--------------|-----------------|-----------|
| **Search Algorithm** | Weighted substring matching with token analysis | Fast, predictable, no dependencies |
| **Default Limit** | 15 results | Balances discoverability with context efficiency |
| **Cache TTL** | 10 minutes | Properties rarely change, excellent hit rate |
| **Cache Storage** | In-memory Map in service | Simple, fast, sufficient for use case |
| **Search Fields** | name, label, description, groupName | Covers all user-facing metadata |

**Key Components**:
1. **Tool Layer**: `properties.search.ts` - MCP tool interface
2. **Service Layer**: Extensions to `PropertiesService` class
3. **Caching**: In-memory cache with 10-minute TTL
4. **Scoring Algorithm**: Weighted scoring (0-100) with match explanations

**Performance Targets**:
- Cold start (cache miss): 220-541ms
- Warm cache (cache hit): 10-20ms
- Context reduction: 94% (15,000 → 900 tokens)

### Phase 3: Code
**Status**: ⏳ Pending

**Implementation Plan** (5-8 hours total):
1. Service Layer (3-4 hours)
   - Add cache infrastructure
   - Implement scoring algorithm
   - Implement search method
2. Tool Layer (1-2 hours)
   - Create `properties.search.ts`
   - Define input schema
3. Integration (30 minutes)
   - Update `index.ts`
   - Add suggestions
4. Documentation (1 hour)

**Files to Create**:
- `src/bcps/Properties/properties.search.ts` (NEW)

**Files to Modify**:
- `src/bcps/Properties/properties.service.ts` (add search methods + caching)
- `src/bcps/Properties/index.ts` (export new tool)
- `src/core/suggestion-config.ts` (add suggestions)

### Phase 4: Test
**Status**: ⏳ Pending

**Test Strategy**:
- Unit tests for scoring algorithm
- Unit tests for cache functionality
- Integration tests for tool handler
- Performance tests
- Manual testing with real HubSpot account

**Test Files to Create**:
- `src/bcps/Properties/__tests__/properties.service.test.ts` (extend existing)
- `src/bcps/Properties/__tests__/properties.search.integration.test.ts` (NEW)

---

## Architecture Highlights

### Component Diagram

```
LLM Context
    ↓
properties.search.ts (Tool Layer)
    ↓
PropertiesService.searchProperties() (Service Layer)
    ↓
In-Memory Cache ←→ HubSpot API
    ↓
Fuzzy Search Algorithm
    ↓
Top N Results (15)
```

### Search Algorithm

**Weighted Scoring System**:
- Exact name match: 40 points
- Name substring: 25 points
- Exact label match: 20 points
- Label substring: 15 points
- Description match: 10 points
- Group name match: 5 points
- Token bonus: 3 points per token

### Caching Strategy

**Key Format**: `${objectType}:${includeArchived}`

**Example Keys**:
- `contacts:false` - Active contact properties
- `contacts:true` - Archived contact properties
- `deals:false` - Active deal properties

**TTL**: 10 minutes
**Hit Rate**: ~95% with typical usage

---

## Benefits

### Context Window Efficiency

| Metric | Before (listProperties) | After (searchProperties) | Improvement |
|--------|------------------------|--------------------------|-------------|
| Properties returned | 250 | 15 | 94% reduction |
| Estimated tokens | ~15,000 | ~900 | 94% reduction |
| Response time (warm) | 220-541ms | 10-20ms | 10-40x faster |

### User Experience

- Find specific properties quickly
- See relevance scores for matches
- Understand why properties matched (match reasons)
- Adjust result count with `limit` parameter
- Filter by property group
- Include/exclude archived properties

### API Efficiency

- 95% reduction in API calls (via caching)
- Faster responses for users
- Lower risk of rate limiting

---

## Alternative Approaches Considered

### Rejected Options

1. **fuse.js library** - External dependency not justified for our simple use case
2. **Levenshtein distance** - Too slow, overly complex for typical queries
3. **Elasticsearch** - Massive overkill for 200-500 properties
4. **TF-IDF scoring** - Benefits don't apply to small corpus
5. **Regular expressions** - Security risk, too complex for users
6. **GraphQL-style filtering** - Unnecessary complexity

### Why Chosen Approach Wins

- No external dependencies
- Fast performance (O(n) complexity)
- Predictable, explainable results
- Simple to maintain
- Handles 95% of real-world queries

---

## Risk Assessment

### Overall Risk Level: LOW

| Risk | Impact | Likelihood | Mitigation | Severity |
|------|--------|-----------|------------|----------|
| Cache staleness | Medium | Low | 10-min TTL acceptable, manual clear method | LOW |
| Memory exhaustion | High | Very Low | 10MB max for large accounts | VERY LOW |
| Poor search results | Medium | Low | Extensive tests, match explanations | LOW |
| API rate limiting | High | Very Low | 95% cache hit rate | VERY LOW |
| Search injection | Medium | Low | Input validation, no regex/eval | LOW |

---

## Next Steps

### For Backend Coder (pact-coder-backend)

1. Read the architecture document: `/docs/architecture/properties-fuzzy-search-design.md`
2. Review the research document: `/docs/preparation/properties-api-filtering-research.md`
3. Follow the implementation plan in the architecture doc
4. Start with service layer (add cache + search methods)
5. Create tool layer (properties.search.ts)
6. Update integration points (index.ts, suggestion-config.ts)
7. Write unit tests for all new methods
8. Write integration tests for tool
9. Perform manual testing with real HubSpot account

### Implementation Order

1. Add type definitions to `properties.service.ts`
2. Implement cache infrastructure
3. Implement `getPropertiesFromAPI()` with archived support
4. Implement `getCachedProperties()` with cache logic
5. Implement `calculateMatchScore()` algorithm
6. Implement `explainMatch()` helper
7. Implement `isCacheHit()` and `clearPropertyCache()`
8. Implement main `searchProperties()` method
9. Create `properties.search.ts` tool
10. Update `index.ts` to export tool
11. Add suggestions to `suggestion-config.ts`
12. Write unit tests
13. Write integration tests
14. Manual testing
15. Update documentation

---

## Success Criteria

### Functional Requirements
- [ ] Tool accepts objectType, query, limit, includeArchived, groupName parameters
- [ ] Returns top N matches sorted by relevance
- [ ] Each match includes score and explanation
- [ ] Cache works correctly with 10-minute TTL
- [ ] Archived properties handled correctly
- [ ] Group filtering works correctly

### Performance Requirements
- [ ] Cold start search: <550ms
- [ ] Warm cache search: <30ms
- [ ] Cache hit rate: >90% in typical usage
- [ ] Memory usage: <10MB for large accounts

### Quality Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing successful
- [ ] Code follows existing patterns
- [ ] Proper error handling
- [ ] Clear logging/debugging

### Documentation Requirements
- [ ] Architecture document complete (✅ Done)
- [ ] Inline code comments added
- [ ] JSDoc comments for all public methods
- [ ] README updated if needed

---

## Related Documents

- **Research**: `/docs/preparation/properties-api-filtering-research.md`
- **Architecture**: `/docs/architecture/properties-fuzzy-search-design.md`
- **Codebase**:
  - `/src/bcps/Properties/properties.service.ts`
  - `/src/bcps/Properties/properties.list.ts`
  - `/src/bcps/Properties/index.ts`

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Prepare | 2 hours | ✅ Complete |
| Architect | 3 hours | ✅ Complete |
| Code | 5-8 hours | ⏳ Pending |
| Test | 2 hours | ⏳ Pending |
| **Total** | **12-15 hours** | **16% Complete** |

**Expected Completion**: Within 1 business day once coding begins

---

## Project Contacts

- **Orchestrator**: PACT Orchestrator
- **Preparer**: pact-preparer (research complete)
- **Architect**: pact-architect (design complete)
- **Coder**: pact-coder-backend (ready to implement)
- **Tester**: pact-test-engineer (ready to test)

---

**Last Updated**: October 30, 2025
**Project Status**: Architecture Phase Complete, Ready for Implementation
