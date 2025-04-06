/**
 * Tools Index
 * 
 * Exports all Hubspot tools from a single entry point.
 */

import { contactTools } from './contact-tools.js';
import { companyTools } from './company-tools.js';
import { engagementTools } from './engagement-tools.js';
import { dealTools } from './deal-tools.js';

/**
 * All Hubspot tools combined
 */
export const hubspotTools = [
    ...contactTools,
    ...companyTools,
    ...engagementTools,
    ...dealTools
];
