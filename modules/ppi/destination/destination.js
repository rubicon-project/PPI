
import { send as gptSend } from './gptDestination.js';
import { send as pageSend } from './pageDestination.js';
import { send as callbackSend } from './callbackDestination.js';
import { send as cacheSend } from './cacheDestination.js';
import { HBDestination } from './../consts.js';
import * as utils from '../../../src/utils.js';

export function send(destination, objects) {
  switch (destination) {
    case HBDestination.GPT:
      gptSend(objects);
      break;
    case HBDestination.PAGE:
      pageSend(objects);
      break;
    case HBDestination.CALLBACK:
      callbackSend(objects);
      break;
    case HBDestination.CACHE:
      cacheSend(objects);
      break;
    default:
      utils.logError('[PPI] Unsupported destination module ', destination);
  }
}
