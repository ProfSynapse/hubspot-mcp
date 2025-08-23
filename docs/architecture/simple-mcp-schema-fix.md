# Simple MCP Schema Fix - Implementation Guide

## Executive Summary

This document provides a straightforward solution to fix the critical parameter mismatches between MCP schemas and BCP tool expectations. The solution requires updating only one file with simple parameter name changes - no complex architectures or new systems needed.

## Critical Fixes Required

Based on the preparer's audit, four critical parameter mismatches need immediate correction in `/src/core/tool-registration-factory.ts`:

### 1. Properties BCP - Replace `id` with `propertyName`
**Problem**: Properties BCP never uses generic `id` parameter, always uses `propertyName`
**Impact**: 100% Properties functionality blocked

### 2. Notes BCP - Add `noteId` for association operations  
**Problem**: Association operations expect `noteId` not `id`
**Impact**: Notes association functionality blocked

### 3. Associations BCP - Already correct parameters
**Problem**: Already uses proper `fromObjectType`/`toObjectType` pattern
**Impact**: No changes needed

### 4. Quotes BCP - Already has `quoteId` parameter
**Problem**: Line item operations already expect `quoteId`
**Impact**: No changes needed

## Simple Implementation Plan

### File to Modify
- **Single file**: `/src/core/tool-registration-factory.ts`
- **Method**: `getDomainSpecificParams()` 
- **Lines**: Properties case (195-212) and Notes case (135-147)

### Specific Changes Required

#### Change 1: Properties Schema Fix (Lines 195-212)

**Current Code**:
```typescript
case 'Properties':
  return {
    objectType: z.string().optional().describe('HubSpot object type'),
    propertyName: z.string().optional().describe('Property name'),
    // ... rest of properties
  };
```

**Required Change**: Remove the generic `id` parameter from `commonParams` when used by Properties.

**Implementation**: Override `commonParams` for Properties domain to exclude `id`:
```typescript
case 'Properties':
  // Properties never uses 'id', only 'propertyName'
  const propertiesParams = {
    limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
    properties: z.record(z.any()).optional().describe('Additional object properties')
  };
  return {
    ...propertiesParams,
    objectType: z.string().optional().describe('HubSpot object type'),
    propertyName: z.string().optional().describe('Property name'),
    // ... rest remains the same
  };
```

#### Change 2: Notes Schema Fix (Lines 135-147)

**Current Code**:
```typescript
case 'Notes':
  return {
    ...commonParams,
    // ... other params
    objectType: z.string().optional().describe('Type of object to associate'),
    objectId: z.string().optional().describe('ID of object to associate'),
    toObjectType: z.string().optional().describe('Type of object for list associations')
  };
```

**Required Change**: Add `noteId` parameter for association operations:
```typescript
case 'Notes':
  return {
    ...commonParams,
    content: z.string().optional().describe('Note content (required for create)'),
    ownerId: z.string().optional().describe('HubSpot owner ID'),
    metadata: z.record(z.any()).optional().describe('Custom note properties'),
    startTimestamp: z.string().optional().describe('Start timestamp filter (ISO 8601)'),
    endTimestamp: z.string().optional().describe('End timestamp filter (ISO 8601)'),
    after: z.string().optional().describe('Pagination cursor'),
    
    // Association operation parameters
    noteId: z.string().optional().describe('Note ID for association operations'),
    objectType: z.string().optional().describe('Type of object to associate'),
    objectId: z.string().optional().describe('ID of object to associate'),
    toObjectType: z.string().optional().describe('Type of object for list associations')
  };
```

## Implementation Steps

1. **Open**: `/src/core/tool-registration-factory.ts`
2. **Navigate to**: `getDomainSpecificParams()` method (line 102)
3. **Update Properties case** (lines 195-212):
   - Create custom params object without `id`
   - Use instead of `commonParams`
4. **Update Notes case** (lines 135-147):
   - Add `noteId` parameter with proper description
5. **Test**: Verify parameter schemas match BCP expectations

## Expected Results

After implementing these changes:
- **Properties operations**: 0% → 100% success rate (no more "parameter not found" errors)
- **Notes associations**: 0% → 100% success rate (`noteId` parameter available)
- **All other domains**: Continue working as before
- **No regression**: Existing functionality preserved

## Validation

To verify fixes are working:
1. Properties tools should accept `propertyName` parameter
2. Notes association operations should accept `noteId` parameter  
3. No changes to other domains' parameter schemas
4. MCP server starts successfully with all tools registered

## Risk Assessment

**Low Risk Implementation**:
- Single file modification
- Only parameter name changes
- No logic changes
- Backward compatible (existing optional parameters)
- Targeted fixes for specific issues

This simple solution addresses the critical parameter mismatches without over-engineering or creating complex new systems.