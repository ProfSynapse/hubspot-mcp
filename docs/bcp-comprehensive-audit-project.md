# BCP Comprehensive Tool Parameter Audit Project

## Project Overview
Conducting a complete audit of ALL BCP tool files to document the actual parameter requirements for each tool. This investigation will serve as the definitive source of truth for building accurate MCP schemas that match exactly what the BCP tools expect.

## Critical Context
User testing has revealed parameter mismatches between our MCP schemas and BCP tool expectations:
- Notes `addAssociation` expects `noteId` (not generic `id`)
- Properties expects `propertyName` (not generic `id`) 
- We need to stop making assumptions and document the actual parameter requirements

## Project Status

### Phase 0: Setup ✅
- [x] Project documentation created
- [x] Task breakdown defined

### Phase 1: Individual BCP Tool Analysis ✅ COMPLETED
- [x] Notes BCP - All tool parameter schemas documented
- [x] Properties BCP - All tool parameter schemas documented  
- [x] Companies BCP - All tool parameter schemas documented
- [x] Contacts BCP - All tool parameter schemas documented
- [x] Associations BCP - All tool parameter schemas documented
- [x] Deals BCP - All tool parameter schemas documented
- [x] Products BCP - All tool parameter schemas documented
- [x] Emails BCP - All tool parameter schemas documented
- [x] BlogPosts BCP - All tool parameter schemas documented
- [x] Quotes BCP - All tool parameter schemas documented

### Phase 2: Cross-Domain Analysis ✅ COMPLETED
- [x] Parameter naming pattern analysis
- [x] Critical mismatch identification
- [x] Priority fix recommendations

### Phase 3: Summary Documentation ✅ COMPLETED
- [x] Comprehensive summary with all findings
- [x] Specific recommendations for MCP schema fixes

## Investigation Method
For each BCP domain, examined ALL `.tool.ts` files and documented:
1. **Tool name** (exact function name)
2. **Required parameters** (from inputSchema.required)
3. **Optional parameters** (from inputSchema.properties but not required)
4. **Parameter types** (string, number, object, array)
5. **Validation rules** (enums, min/max, patterns)
6. **Complex structures** (nested objects, arrays)

## Key Focus Areas
- **ID parameter naming patterns** across all domains ✅
- **Association operation parameters** (critical user pain point) ✅
- **Property identification parameters** (propertyName vs id patterns) ✅
- **Object type specification patterns** ✅
- **Complex nested parameter structures** ✅

## Deliverables ✅ ALL COMPLETED

### 1. Individual Domain Parameter Documentation Files:
- `/mnt/c/Users/jrose/Documents/Code/hubspot-mcp/docs/preparation/notes-bcp-complete-audit.md`
- `/mnt/c/Users/jrose/Documents/Code/hubspot-mcp/docs/preparation/properties-bcp-complete-audit.md`

### 2. Cross-Domain Pattern Analysis:
- `/mnt/c/Users/jrose/Documents/Code/hubspot-mcp/docs/preparation/comprehensive-bcp-parameter-audit-summary.md`

### 3. Critical Mismatch Summary with Priority Fixes:
- `/mnt/c/Users/jrose/Documents/Code/hubspot-mcp/docs/preparation/critical-mcp-schema-fixes-required.md`

## Critical Findings Summary

### CONFIRMED CRITICAL PARAMETER MISMATCHES:

#### 1. Properties BCP (COMPLETE INCOMPATIBILITY)
- **Uses `propertyName` for ALL operations** - NEVER uses generic `id`
- **Group operations use `groupName`** - NEVER uses generic `id`
- **100% of Properties functionality broken** with current generic schemas

#### 2. Notes BCP (CONDITIONAL INCOMPATIBILITY)
- **CRUD operations**: Use generic `id` (get, delete, update)
- **Association operations**: Use `noteId` (addAssociation, listAssociations, removeAssociation)
- **Special case**: listAssociations uses `toObjectType` not `objectType`

#### 3. Associations BCP (ARCHITECTURAL INCOMPATIBILITY)
- **Bidirectional parameters**: `fromObjectType`/`fromObjectId` + `toObjectType`/`toObjectId`
- **Complex association types**: Array with `associationCategory` enum + `associationTypeId`
- **Completely different** from simple ID-based patterns

#### 4. Quotes BCP (SELECTIVE INCOMPATIBILITY)  
- **Standard operations**: Use generic `id` (get, delete, update, create)
- **Line item operations**: Use `quoteId` (addLineItem, removeLineItem, updateLineItem, listLineItems)

### WORKING BCPs (Generic ID Compatible):
- Companies, Contacts, Deals, Products, Emails, BlogPosts (standard operations)

## Impact Assessment

### Production Blockers:
1. **Properties**: 100% functionality broken
2. **Notes Associations**: Association functionality broken
3. **Association Management**: All association operations broken
4. **Quotes Line Items**: Line item functionality broken

### Root Cause:
**MCP Schema Layer assumes generic parameter consistency** but **HubSpot BCPs evolved with domain-specific parameter patterns** reflecting their API designs.

## Next Steps for Implementation Team

### IMMEDIATE CRITICAL FIXES (This Week):
1. **Replace Properties schemas** - Use `propertyName` instead of `id`
2. **Implement Notes conditional routing** - Route `id` vs `noteId` based on operation
3. **Update Associations schemas** - Implement bidirectional parameter patterns
4. **Fix Quotes line item schemas** - Use `quoteId` for line item operations

### Implementation Guide:
See `/mnt/c/Users/jrose/Documents/Code/hubspot-mcp/docs/preparation/critical-mcp-schema-fixes-required.md` for detailed technical fixes and implementation roadmap.

---
**PROJECT STATUS: ✅ COMPLETED SUCCESSFULLY**
*Last Updated: 2025-08-23*
*All critical parameter mismatches identified and documented with fix recommendations*