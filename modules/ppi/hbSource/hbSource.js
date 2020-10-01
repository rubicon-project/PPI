import { auctionSourceSubmodule } from './auctionSource.js';
import { cacheSourceSubmodule } from './cacheSource.js';

export const hbSource = {};
hbSource[auctionSourceSubmodule.name] = auctionSourceSubmodule;
hbSource[cacheSourceSubmodule.name] = cacheSourceSubmodule;
