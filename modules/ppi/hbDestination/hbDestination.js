import { cacheDestinationSubmodule } from './cacheDestination.js';
import { gptDestinationSubmodule } from './gptDestination.js';
import { pageDestinationSubmodule } from './pageDestination.js';
import { callbackDestinationSubmodule } from './callbackDestination.js';

export const hbDestination = {};
hbDestination[cacheDestinationSubmodule.name] = cacheDestinationSubmodule;
hbDestination[gptDestinationSubmodule.name] = gptDestinationSubmodule;
hbDestination[pageDestinationSubmodule.name] = pageDestinationSubmodule;
hbDestination[callbackDestinationSubmodule.name] = callbackDestinationSubmodule;
