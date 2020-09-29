/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
export function hashFnv32a(str, asString, seed) {
  let hval = (seed === undefined) ? 0x811c9dc5 : seed;
  for (let i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  if (asString) {
    // Convert to 8 digit hex string
    return ('0000000' + (hval >>> 0).toString(16)).substr(-8);
  }
  return hval >>> 0;
}

/**
 * // get current viewport
 * @returns {Array} viewport size [w, h]
 */
export function getViewport() {
  return [window.innerWidth, window.innerHeight];
}

/**
 * @param {Array} list
 * @param {function(item:*)} callback
 * @returns {*}
 */
export function find(list, callback) {
  if (!Array.isArray(list)) {
    return;
  }
  for (let i = 0; i < list.length; i++) {
    if (callback(list[i])) {
      return list[i];
    }
  }
}

export function isRegex(str) {
  return ['.', '*', '^', '$'].some(p => str.indexOf(p) !== -1);
}
