/**
 * Association Type Helper
 * 
 * This module provides helper functions for working with HubSpot association types.
 * It maintains a cache of common association types and provides functions to look up
 * association types between different object types.
 */

// Cache of common association types
// Format: fromObjectType -> toObjectType -> associationType -> typeId
const associationTypeCache = {
  // Notes to other objects
  'notes': {
    'contacts': {
      'default': 202,
      'meeting': 206,
      'call': 208,
      'email': 210,
      'task': 212
    },
    'companies': {
      'default': 214
    },
    'deals': {
      'default': 216
    },
    'tickets': {
      'default': 218
    }
  },
  
  // Contacts to other objects
  'contacts': {
    'companies': {
      'primary': 1,
      'non-primary': 2
    },
    'deals': {
      'default': 3
    },
    'tickets': {
      'default': 16
    }
  },
  
  // Companies to other objects
  'companies': {
    'contacts': {
      'primary': 1,
      'non-primary': 2
    },
    'deals': {
      'default': 5
    }
  },
  
  // Deals to other objects
  'deals': {
    'contacts': {
      'default': 3
    },
    'companies': {
      'default': 5
    },
    'tickets': {
      'default': 25
    }
  },
  
  // Tickets to other objects
  'tickets': {
    'contacts': {
      'default': 16
    },
    'companies': {
      'default': 26
    },
    'deals': {
      'default': 25
    }
  }
};

/**
 * Get the association type ID for a given pair of object types and association type name
 * 
 * @param {string} fromObjectType - The source object type (e.g., 'notes', 'contacts')
 * @param {string} toObjectType - The target object type (e.g., 'contacts', 'companies')
 * @param {string} [associationType='default'] - The association type name (e.g., 'primary', 'meeting')
 * @returns {number|null} The association type ID, or null if not found
 */
function getAssociationTypeId(fromObjectType, toObjectType, associationType = 'default') {
  // Normalize object types (e.g., 'contact' -> 'contacts')
  const normalizedFromType = fromObjectType.toLowerCase().endsWith('s')
    ? fromObjectType.toLowerCase()
    : `${fromObjectType.toLowerCase()}s`;
  
  const normalizedToType = toObjectType.toLowerCase().endsWith('s')
    ? toObjectType.toLowerCase()
    : `${toObjectType.toLowerCase()}s`;
  
  // Normalize association type
  const normalizedAssociationType = associationType ? associationType.toLowerCase() : 'default';
  
  // Check if we have this association type in the cache
  if (
    associationTypeCache[normalizedFromType] &&
    associationTypeCache[normalizedFromType][normalizedToType] &&
    associationTypeCache[normalizedFromType][normalizedToType][normalizedAssociationType]
  ) {
    return associationTypeCache[normalizedFromType][normalizedToType][normalizedAssociationType];
  }
  
  // If we don't have the specific association type, try the default
  if (
    associationTypeCache[normalizedFromType] &&
    associationTypeCache[normalizedFromType][normalizedToType] &&
    associationTypeCache[normalizedFromType][normalizedToType]['default']
  ) {
    console.warn(`Association type '${normalizedAssociationType}' not found for ${normalizedFromType} -> ${normalizedToType}. Using default.`);
    return associationTypeCache[normalizedFromType][normalizedToType]['default'];
  }
  
  // If we don't have any association types for these object types, return null
  console.warn(`No association types found for ${normalizedFromType} -> ${normalizedToType}`);
  return null;
}

/**
 * Add or update an association type in the cache
 * 
 * @param {string} fromObjectType - The source object type
 * @param {string} toObjectType - The target object type
 * @param {string} associationType - The association type name
 * @param {number} typeId - The association type ID
 */
function addAssociationType(fromObjectType, toObjectType, associationType, typeId) {
  // Normalize object types
  const normalizedFromType = fromObjectType.toLowerCase().endsWith('s')
    ? fromObjectType.toLowerCase()
    : `${fromObjectType.toLowerCase()}s`;
  
  const normalizedToType = toObjectType.toLowerCase().endsWith('s')
    ? toObjectType.toLowerCase()
    : `${toObjectType.toLowerCase()}s`;
  
  // Normalize association type
  const normalizedAssociationType = associationType ? associationType.toLowerCase() : 'default';
  
  // Initialize cache structure if needed
  if (!associationTypeCache[normalizedFromType]) {
    associationTypeCache[normalizedFromType] = {};
  }
  
  if (!associationTypeCache[normalizedFromType][normalizedToType]) {
    associationTypeCache[normalizedFromType][normalizedToType] = {};
  }
  
  // Add or update the association type
  associationTypeCache[normalizedFromType][normalizedToType][normalizedAssociationType] = typeId;
}

/**
 * Get all cached association types for a given pair of object types
 * 
 * @param {string} fromObjectType - The source object type
 * @param {string} toObjectType - The target object type
 * @returns {Object|null} An object mapping association type names to type IDs, or null if not found
 */
function getAssociationTypes(fromObjectType, toObjectType) {
  // Normalize object types
  const normalizedFromType = fromObjectType.toLowerCase().endsWith('s')
    ? fromObjectType.toLowerCase()
    : `${fromObjectType.toLowerCase()}s`;
  
  const normalizedToType = toObjectType.toLowerCase().endsWith('s')
    ? toObjectType.toLowerCase()
    : `${toObjectType.toLowerCase()}s`;
  
  // Check if we have any association types for these object types
  if (
    associationTypeCache[normalizedFromType] &&
    associationTypeCache[normalizedFromType][normalizedToType]
  ) {
    return { ...associationTypeCache[normalizedFromType][normalizedToType] };
  }
  
  return null;
}

/**
 * Get a list of all object types in the cache
 * 
 * @returns {string[]} An array of object types
 */
function getObjectTypes() {
  return Object.keys(associationTypeCache);
}

/**
 * Get a reference table of all association types in the cache
 * 
 * @returns {string} A formatted string containing the reference table
 */
function getReferenceTable() {
  let table = 'Common Association Types:\n';
  
  for (const fromType in associationTypeCache) {
    for (const toType in associationTypeCache[fromType]) {
      for (const assocType in associationTypeCache[fromType][toType]) {
        const typeId = associationTypeCache[fromType][toType][assocType];
        const assocTypeDisplay = assocType === 'default' ? '' : ` (${assocType})`;
        table += `- ${fromType} → ${toType}${assocTypeDisplay}: ${typeId}\n`;
      }
    }
  }
  
  return table;
}

module.exports = {
  getAssociationTypeId,
  addAssociationType,
  getAssociationTypes,
  getObjectTypes,
  getReferenceTable
};
