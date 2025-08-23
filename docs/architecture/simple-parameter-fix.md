# Simple Parameter Validation Fix

## Problem Analysis

After testing, we found exactly 4 parameter name mismatches between the Tool Registration Factory and the BCP tools:

### Critical Mismatches:
1. **Notes Associations**: Factory uses `associationObjectType` → BCP expects `objectType`
2. **Notes Associations**: Factory uses `associationObjectId` → BCP expects `objectId`  
3. **Notes List Associations**: Factory uses `associationObjectType` → BCP expects `toObjectType`
4. **Properties**: Factory uses `id` → BCP expects `propertyName`

## Root Cause

The Tool Registration Factory was designed with generic parameter names, but BCP tools use specific parameter names that make sense for their domain context.

## Simple Solution: Fix the Schema Definitions

**Recommendation**: Update the Tool Registration Factory schema definitions to match what the BCP tools expect.

### Implementation Steps

#### 1. Fix Notes Parameters (File: `/src/core/tool-registration-factory.ts`)

**Current (Lines 144-145):**
```typescript
associationObjectType: z.string().optional().describe('Type of object to associate'),
associationObjectId: z.string().optional().describe('ID of object to associate')
```

**Fixed:**
```typescript
objectType: z.string().optional().describe('Type of object to associate'),
objectId: z.string().optional().describe('ID of object to associate'),
toObjectType: z.string().optional().describe('Type of object for list associations')
```

#### 2. Remove Generic ID for Properties (Lines 196-198)

**Current:**
```typescript
id: z.string().optional().describe('Object ID (required for get, update, delete operations)'),
propertyName: z.string().optional().describe('Property name'),
```

**Fixed (remove the id parameter entirely for Properties):**
```typescript
propertyName: z.string().optional().describe('Property name'),
```

#### 3. Test the Fix

After making these changes:
1. Test Notes with associations: `createWithAssociations`, `addAssociation`, `listAssociations`
2. Test Properties: `get`, `update`, `delete` operations
3. Verify all other domains still work correctly

## Why This Solution Works

1. **Minimal Changes**: Only 3 lines need to be modified
2. **No New Code**: Uses existing architecture patterns
3. **Maintains Type Safety**: All Zod schemas remain intact
4. **Follows Domain Logic**: Parameter names now match what BCP tools expect
5. **Quick Implementation**: Takes < 15 minutes to implement and test

## Files to Modify

- `/src/core/tool-registration-factory.ts` (Lines 144-145 and 105 in Properties section)

## Testing Plan

1. **Notes Association Test**:
   ```bash
   # Test adding association to note
   curl -X POST "http://localhost:3000/call" \
     -d '{"tool":"hubspotNotes","operation":"addAssociation","id":"123","objectType":"contacts","objectId":"456"}'
   ```

2. **Properties Test**:
   ```bash
   # Test getting property
   curl -X POST "http://localhost:3000/call" \
     -d '{"tool":"hubspotProperties","operation":"get","objectType":"contacts","propertyName":"email"}'
   ```

## Business Impact

- **Fixes Critical User Workflow**: Notes with associations will work immediately
- **Enables Properties Management**: Properties CRUD operations will function
- **Zero Downtime**: Simple schema changes require no service restart
- **Maintains Backward Compatibility**: All existing working operations continue to work

This fix addresses the exact 4 parameter mismatches identified during user testing with minimal code changes and maximum business value.