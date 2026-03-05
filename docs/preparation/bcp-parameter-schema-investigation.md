# HubSpot BCP Parameter Schema Investigation Project

## Project Overview

This investigation aims to comprehensively analyze all HubSpot BCP tool parameter schemas to identify naming mismatches that are causing validation failures in our delegation architecture.

## Problem Statement

We have a two-layer delegation architecture:
- **MCP Schema Layer** (Tool Registration Factory): Uses generic parameter names like `associationObjectId`, `id`
- **BCP Tool Layer** (Actual handlers): Uses specific parameter names like `noteId`, `objectId`

This parameter naming mismatch causes validation failures even though routing works correctly.

## Investigation Progress

### Phase 1: BCP Domain Analysis - COMPLETED ✅
- [x] Notes BCP - Parameter schemas documented
- [x] Properties BCP - Parameter schemas documented  
- [x] Companies BCP - Parameter schemas documented
- [x] Contacts BCP - Parameter schemas documented
- [x] Associations BCP - Parameter schemas documented
- [x] Deals BCP - Parameter schemas documented
- [x] Products BCP - Parameter schemas documented
- [x] Emails BCP - Parameter schemas documented
- [x] BlogPosts BCP - Parameter schemas documented
- [x] Quotes BCP - Parameter schemas documented

### Phase 2: Documentation Creation - COMPLETED ✅
- [x] Individual BCP parameter documentation files created
- [x] Pattern analysis summary created
- [x] Schema alignment recommendations generated

## Key Focus Areas

1. **Association-related parameters** - Main pain point causing failures
2. **ID parameters** - Inconsistency between `id` vs specific IDs like `noteId`
3. **Object type parameters** - Cross-domain parameter consistency
4. **Cross-domain parameter patterns** - Identifying consistent naming conventions

## Deliverables Created

1. **Individual BCP Documentation**:
   - `/docs/preparation/notes-bcp-parameter-schemas.md`
   - `/docs/preparation/properties-bcp-parameter-schemas.md`
   - `/docs/preparation/companies-bcp-parameter-schemas.md`
   - `/docs/preparation/remaining-bcps-parameter-schemas.md`

2. **Comprehensive Analysis**:
   - `/docs/preparation/comprehensive-bcp-parameter-analysis.md`

3. **Strategic Recommendations**: Included in comprehensive analysis

## Investigation Results Summary

### Critical Findings Identified:

1. **ID Parameter Inconsistencies**: Generic `id` vs specific IDs (`noteId`, `quoteId`, `propertyName`)

2. **Association Parameter Mismatches**: Simple vs complex association structures across BCPs

3. **Object Type Parameter Variations**: Different patterns for `objectType`, `toObjectType`, `fromObjectType`

4. **Complex Parameter Structures**: Nested arrays and objects requiring special validation

### Main Problem Areas:

- **Notes BCP**: Uses both `id` and `noteId` depending on operation
- **Properties BCP**: Uses `propertyName` instead of generic `id`  
- **Associations BCP**: Complex `from`/`to` parameter patterns
- **Quotes BCP**: Uses `quoteId` for line item operations

### Schema Alignment Strategy Recommended:

1. **Parameter Name Mapping Layer** between MCP and BCP layers
2. **Schema Transformation** for complex nested structures  
3. **Association Parameter Unification** across all BCPs
4. **Validation Adapter Pattern** for handling different parameter schemas

## Investigation Completed
Date: 2025-08-23
Status: ✅ COMPLETED

**Next Steps**: Pass documentation to Architecture team for schema alignment implementation strategy.