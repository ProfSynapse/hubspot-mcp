/**
 * Location: /src/bcps/Lists/lists.types.ts
 *
 * TypeScript type definitions for Lists BCP
 * Defines all interfaces, types, and enums for HubSpot Lists API v3
 */

/**
 * List processing types
 */
export type ProcessingType = 'MANUAL' | 'DYNAMIC' | 'SNAPSHOT';

/**
 * Supported object type IDs
 */
export type ObjectTypeId = '0-1' | '0-2' | '0-3' | '0-5' | '0-7' | '0-47' | '0-48' | '0-53' | '0-54';

/**
 * Filter branch types
 */
export type FilterBranchType = 'OR' | 'AND' | 'UNIFIED_EVENTS' | 'ASSOCIATION';

/**
 * Property filter operation types
 */
export type OperationType = 'MULTISTRING' | 'NUMBER' | 'BOOL' | 'TIME_POINT';

/**
 * Filter operators by operation type
 */
export type MultistringOperator =
  | 'IS_EQUAL_TO'
  | 'IS_NOT_EQUAL_TO'
  | 'CONTAINS'
  | 'DOES_NOT_CONTAIN'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'HAS_EVER_BEEN_EQUAL_TO'
  | 'HAS_NEVER_BEEN_EQUAL_TO'
  | 'HAS_EVER_CONTAINED'
  | 'HAS_NEVER_CONTAINED'
  | 'IS_BETWEEN'
  | 'IS_NOT_BETWEEN'
  | 'IS_KNOWN'
  | 'IS_NOT_KNOWN';

export type NumberOperator =
  | 'IS_EQUAL_TO'
  | 'IS_NOT_EQUAL_TO'
  | 'IS_GREATER_THAN'
  | 'IS_LESS_THAN'
  | 'IS_GREATER_THAN_OR_EQUAL_TO'
  | 'IS_LESS_THAN_OR_EQUAL_TO'
  | 'IS_BETWEEN'
  | 'IS_NOT_BETWEEN'
  | 'HAS_EVER_BEEN_EQUAL_TO'
  | 'HAS_NEVER_BEEN_EQUAL_TO'
  | 'IS_KNOWN'
  | 'IS_NOT_KNOWN';

export type BoolOperator =
  | 'IS_EQUAL_TO'
  | 'IS_NOT_EQUAL_TO'
  | 'IS_KNOWN'
  | 'IS_NOT_KNOWN';

export type TimePointOperator =
  | 'IS_EQUAL_TO'
  | 'IS_AFTER'
  | 'IS_BEFORE'
  | 'IS_BETWEEN'
  | 'IS_RELATIVE'
  | 'IS_WITHIN_TIME_WINDOW';

/**
 * Core List object
 */
export interface List {
  listId: string;
  name: string;
  objectTypeId: ObjectTypeId;
  processingType: ProcessingType;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  filterBranch?: FilterBranch;
  membershipCount?: number;
}

/**
 * Filter branch structure (hierarchical)
 */
export interface FilterBranch {
  filterBranchType: FilterBranchType;
  filterBranches: FilterBranch[];
  filters: PropertyFilter[];
}

/**
 * Property filter
 */
export interface PropertyFilter {
  filterType: 'PROPERTY';
  property: string;
  operation: FilterOperation;
}

/**
 * Filter operations (union type based on operationType)
 */
export type FilterOperation =
  | MultistringOperation
  | NumberOperation
  | BoolOperation
  | TimePointOperation;

export interface MultistringOperation {
  operationType: 'MULTISTRING';
  operator: MultistringOperator;
  values?: string[];
}

export interface NumberOperation {
  operationType: 'NUMBER';
  operator: NumberOperator;
  value?: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface BoolOperation {
  operationType: 'BOOL';
  operator: BoolOperator;
  value?: boolean;
}

export interface TimePointOperation {
  operationType: 'TIME_POINT';
  operator: TimePointOperator;
  timestamp?: number;
  lowerBound?: number;
  upperBound?: number;
  rangeType?: 'ROLLING' | 'FIXED';
  timeUnit?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  offset?: number;
}

/**
 * List creation parameters
 */
export interface CreateListParams {
  name: string;
  objectTypeId: ObjectTypeId;
  processingType: ProcessingType;
  filterBranch?: FilterBranch;
}

/**
 * Search lists parameters
 */
export interface SearchListsParams {
  listIds?: string[];
  offset?: number;
  count?: number;
  processingTypes?: ProcessingType[];
  additionalProperties?: string[];
  query?: string;
  includeFilters?: boolean;
}

/**
 * Search lists response
 */
export interface SearchListsResponse {
  lists: List[];
  total: number;
  hasMore: boolean;
}

/**
 * Get members parameters
 */
export interface GetMembersParams {
  limit?: number;
  after?: string;
}

/**
 * Members page (paginated result)
 */
export interface MembersPage {
  members: ListMember[];
  pagination?: {
    after?: string;
  };
  total?: number;
}

/**
 * List member
 */
export interface ListMember {
  recordId: string;
  addedAt?: string;
}

/**
 * Membership operation result
 */
export interface MembershipResult {
  success: boolean;
  recordsAdded?: number;
  recordsRemoved?: number;
  listId: string;
}

/**
 * Type guards
 */
export function isDynamicList(list: List): boolean {
  return list.processingType === 'DYNAMIC';
}

export function isManualList(list: List): boolean {
  return list.processingType === 'MANUAL';
}

export function isSnapshotList(list: List): boolean {
  return list.processingType === 'SNAPSHOT';
}

export function canAddMembersManually(list: List): boolean {
  return list.processingType === 'MANUAL' || list.processingType === 'SNAPSHOT';
}

export function requiresFilters(processingType: ProcessingType): boolean {
  return processingType === 'DYNAMIC' || processingType === 'SNAPSHOT';
}
