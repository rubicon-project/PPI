import { cacheDestinationSubmodule } from './cacheDestination.js';
import { gptDestinationSubmodule } from './gptDestination.js';
import { pageDestinationSubmodule } from './pageDestination.js';
import { callbackDestinationSubmodule } from './callbackDestination.js';

/**
 * This object holds all available hbDestination submodules, available are only: 'gpt', 'page', 'cache' and 'callback'
 */
export const hbDestination = {};
hbDestination[cacheDestinationSubmodule.name] = cacheDestinationSubmodule;
hbDestination[gptDestinationSubmodule.name] = gptDestinationSubmodule;
hbDestination[pageDestinationSubmodule.name] = pageDestinationSubmodule;
hbDestination[callbackDestinationSubmodule.name] = callbackDestinationSubmodule;
