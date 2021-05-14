import { auctionSourceSubmodule } from './auctionSource.js';
import { cacheSourceSubmodule } from './cacheSource.js';

/**
 * This object holds all available hbSource submodules, currently only 'auction' and 'cache' are available
 */
export const hbSource = {};

hbSource[auctionSourceSubmodule.name] = auctionSourceSubmodule;
hbSource[cacheSourceSubmodule.name] = cacheSourceSubmodule;
