/**
 * Configuration Module
 * 
 * Centralizes all configuration settings for the Hubspot MCP server.
 * Loads environment variables and provides type-safe access to configuration.
 * Validates required settings and provides sensible defaults for optional ones.
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

// Process command line arguments for environment variables
const args = process.argv.slice(2);
const envArgs: { [key: string]: string } = {};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' && i + 1 < args.length) {
        const [key, value] = args[i + 1].split('=');
        if (key && value) {
            envArgs[key] = value;
        }
        i++;
    } else if (args[i] === '--access-token' && i + 1 < args.length) {
        envArgs['HUBSPOT_ACCESS_TOKEN'] = args[i + 1];
        i++;
    }
}

/**
 * Configuration interface defining all available settings
 */
export interface Config {
    // Hubspot API Configuration
    hubspotAccessToken: string;
    hubspotApiUrl: string;

    // Service Configuration
    serviceTimeout: number;

    // Optional Settings
    debug: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * The configuration object with all settings
 * Command line arguments take precedence over environment variables
 */
const configuration: Config = {
    // Hubspot API Configuration
    hubspotAccessToken: envArgs.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN || '',
    hubspotApiUrl: envArgs.HUBSPOT_API_URL || process.env.HUBSPOT_API_URL || 'https://api.hubapi.com',

    // Service Configuration
    serviceTimeout: parseInt(envArgs.SERVICE_TIMEOUT || process.env.SERVICE_TIMEOUT || '30000', 10),

    // Optional Settings
    debug: (envArgs.DEBUG || process.env.DEBUG || 'false').toLowerCase() === 'true',
    logLevel: (envArgs.LOG_LEVEL || process.env.LOG_LEVEL || 'info') as Config['logLevel'],
};

/**
 * Validate required configuration settings
 */
const validateConfig = (config: Config): void => {
    const missingEnvVars = Object.entries(config)
        .filter(([key, value]) => {
            // Only check required fields
            if (key === 'hubspotAccessToken') {
                return !value;
            }
            return false;
        })
        .map(([key]) => key);

    if (missingEnvVars.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missingEnvVars.join(', ')}`
        );
    }
};

// Validate configuration
validateConfig(configuration);

export default configuration;
