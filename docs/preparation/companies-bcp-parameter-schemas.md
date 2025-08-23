# Companies BCP Parameter Schema Analysis

## Overview
The Companies BCP contains 6 tools for managing HubSpot companies. This analysis documents all parameter schemas used by each tool.

## Tool Parameter Schemas

### 1. create (createCompany)
- **Required Parameters:**
  - `name` (string) - Company name
- **Optional Parameters:**
  - `domain` (string) - Company website domain
  - `industry` (string, enum) - Company industry with extensive predefined values
  - `description` (string) - Company description
  - `additionalProperties` (object) - Additional company properties

### 2. get (getCompany)
- **Required Parameters:**
  - `id` (string) - HubSpot company ID

### 3. delete (deleteCompany)
- **Required Parameters:**
  - `id` (string) - HubSpot company ID

### 4. update (updateCompany)
- **Required Parameters:**
  - `id` (string) - HubSpot company ID
- **Optional Parameters:**
  - `name` (string) - Company name
  - `domain` (string) - Company website domain
  - `industry` (string) - Company industry
  - `description` (string) - Company description
  - `additionalProperties` (object) - Additional company properties

### 5. search (searchCompanies)
- **Required Parameters:**
  - `searchType` (string, enum) - Type of search: "name" or "domain"
  - `searchTerm` (string) - Term to search for
- **Optional Parameters:**
  - `limit` (integer) - Maximum results (1-100, default: 10)

### 6. recent (getRecentCompanies)
- **Required Parameters:** None
- **Optional Parameters:**
  - `limit` (integer) - Maximum results (1-100, default: 10)
  - `operation` (string, enum) - Always "recent" (seems redundant)

## Parameter Naming Patterns Identified

### ID Parameters
- **Generic ID**: `id` - Used consistently in get, delete, update tools

### Core Object Properties
- **Name**: `name` - Used for company name
- **Domain**: `domain` - Used for website domain
- **Industry**: `industry` - Used with extensive enum validation
- **Description**: `description` - Used for descriptive text

### Search Parameters
- **Search Type**: `searchType` - Used with enum constraints for search operations
- **Search Term**: `searchTerm` - Used for search input

### Pagination Parameters
- **Limit**: `limit` - Used consistently with appropriate constraints (1-100)

### Extension Parameters
- **Additional Properties**: `additionalProperties` - Used as catch-all object for custom properties

## Notable Characteristics

1. **Comprehensive Industry Enum**: The create tool includes an extensive industry enum with 60+ valid values
2. **Consistent ID Pattern**: Uses generic `id` parameter across all CRUD operations
3. **Flexible Property Extension**: `additionalProperties` pattern for custom fields
4. **Search Specialization**: Dedicated search types for name vs domain searches