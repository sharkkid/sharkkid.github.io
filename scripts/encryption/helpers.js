"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

/* eslint-env browser */
function uint8ArrayToBase64Url(uint8Array, start, end) {
  start = start || 0;
  end = end || uint8Array.byteLength;
  var base64 = window.btoa(String.fromCharCode.apply(null, uint8Array.subarray(start, end)));
  return base64.replace(/\=/g, '') // eslint-disable-line no-useless-escape
  .replace(/\+/g, '-').replace(/\//g, '_');
} // Converts the URL-safe base64 encoded |base64UrlData| to an Uint8Array buffer.


function base64UrlToUint8Array(base64UrlData) {
  var padding = '='.repeat((4 - base64UrlData.length % 4) % 4);
  var base64 = (base64UrlData + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var buffer = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
    buffer[i] = rawData.charCodeAt(i);
  }

  return buffer;
} // Super inefficient. But easier to follow than allocating the
// array with the correct size and position values in that array
// as required.


function joinUint8Arrays(allUint8Arrays) {
  return allUint8Arrays.reduce(function (cumulativeValue, nextValue) {
    if (!(nextValue instanceof Uint8Array)) {
      console.error('Received an non-Uint8Array value:', nextValue);
      throw new Error('Received an non-Uint8Array value.');
    }

    var joinedArray = new Uint8Array(cumulativeValue.byteLength + nextValue.byteLength);
    joinedArray.set(cumulativeValue, 0);
    joinedArray.set(nextValue, cumulativeValue.byteLength);
    return joinedArray;
  }, new Uint8Array());
}

function arrayBuffersToCryptoKeys(_x, _x2) {
  return _arrayBuffersToCryptoKeys.apply(this, arguments);
}

function _arrayBuffersToCryptoKeys() {
  _arrayBuffersToCryptoKeys = _asyncToGenerator(function* (publicKey, privateKey) {
    // Length, in bytes, of a P-256 field element. Expected format of the private
    // key.
    var PRIVATE_KEY_BYTES = 32; // Length, in bytes, of a P-256 public key in uncompressed EC form per SEC
    // 2.3.3. This sequence must start with 0x04. Expected format of the
    // public key.

    var PUBLIC_KEY_BYTES = 65;

    if (publicKey.byteLength !== PUBLIC_KEY_BYTES) {
      throw new Error('The publicKey is expected to be ' + PUBLIC_KEY_BYTES + ' bytes.');
    } // Cast ArrayBuffer to Uint8Array


    var publicBuffer = new Uint8Array(publicKey);

    if (publicBuffer[0] !== 0x04) {
      throw new Error('The publicKey is expected to start with an ' + '0x04 byte.');
    }

    var jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: window.uint8ArrayToBase64Url(publicBuffer, 1, 33),
      y: window.uint8ArrayToBase64Url(publicBuffer, 33, 65),
      ext: true
    };
    var keyPromises = [];
    keyPromises.push(crypto.subtle.importKey('jwk', jwk, {
      name: 'ECDH',
      namedCurve: 'P-256'
    }, true, []));

    if (privateKey) {
      if (privateKey.byteLength !== PRIVATE_KEY_BYTES) {
        throw new Error('The privateKey is expected to be ' + PRIVATE_KEY_BYTES + ' bytes.');
      } // d must be defined after the importKey call for public


      jwk.d = window.uint8ArrayToBase64Url(privateKey);
      keyPromises.push(crypto.subtle.importKey('jwk', jwk, {
        name: 'ECDH',
        namedCurve: 'P-256'
      }, true, ['deriveBits']));
    }

    var keys = yield Promise.all(keyPromises);
    var keyPair = {
      publicKey: keys[0]
    };

    if (keys.length > 1) {
      keyPair.privateKey = keys[1];
    }

    return keyPair;
  });
  return _arrayBuffersToCryptoKeys.apply(this, arguments);
}

function cryptoKeysToUint8Array(_x3, _x4) {
  return _cryptoKeysToUint8Array.apply(this, arguments);
}

function _cryptoKeysToUint8Array() {
  _cryptoKeysToUint8Array = _asyncToGenerator(function* (publicKey, privateKey) {
    var promises = [];
    var jwk = yield crypto.subtle.exportKey('jwk', publicKey);
    var x = window.base64UrlToUint8Array(jwk.x);
    var y = window.base64UrlToUint8Array(jwk.y);
    var pubJwk = new Uint8Array(65);
    pubJwk.set([0x04], 0);
    pubJwk.set(x, 1);
    pubJwk.set(y, 33);
    promises.push(pubJwk);

    if (privateKey) {
      var _jwk = yield crypto.subtle.exportKey('jwk', privateKey);

      promises.push(window.base64UrlToUint8Array(_jwk.d));
    }

    var exportedKeys = yield Promise.all(promises);
    var result = {
      publicKey: exportedKeys[0]
    };

    if (exportedKeys.length > 1) {
      result.privateKey = exportedKeys[1];
    }

    return result;
  });
  return _cryptoKeysToUint8Array.apply(this, arguments);
}

function generateSalt() {
  var SALT_BYTES = 16;
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

if (window) {
  window.uint8ArrayToBase64Url = uint8ArrayToBase64Url;
  window.base64UrlToUint8Array = base64UrlToUint8Array;
  window.joinUint8Arrays = joinUint8Arrays;
  window.arrayBuffersToCryptoKeys = arrayBuffersToCryptoKeys;
  window.cryptoKeysToUint8Array = cryptoKeysToUint8Array;
  window.generateSalt = generateSalt;
} else if (module && module.exports) {
  module.exports = {
    uint8ArrayToBase64Url,
    base64UrlToUint8Array,
    joinUint8Arrays,
    arrayBuffersToCryptoKeys,
    cryptoKeysToUint8Array
  };
}