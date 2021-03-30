"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

/**
 * PLEASE NOTE: This is in no way complete. This is just enabling
 * some testing in the browser / on github pages.
 *
 * Massive H/T to Peter Beverloo for this.
 */

/* eslint-env browser */
class VapidHelper2 {
  static createVapidAuthHeader(vapidKeys, audience, subject, exp) {
    return _asyncToGenerator(function* () {
      if (!audience) {
        return Promise.reject(new Error('Audience must be the origin of the ' + 'server'));
      }

      if (!subject) {
        return Promise.reject(new Error('Subject must be either a mailto or ' + 'http link'));
      }

      if (typeof exp !== 'number') {
        // The `exp` field will contain the current timestamp in UTC plus
        // twelve hours.
        exp = Math.floor(Date.now() / 1000 + 12 * 60 * 60);
      }

      var publicApplicationServerKey = window.base64UrlToUint8Array(vapidKeys.publicKey);
      var privateApplicationServerKey = window.base64UrlToUint8Array(vapidKeys.privateKey); // Ensure the audience is just the origin

      audience = new URL(audience).origin;
      var tokenHeader = {
        typ: 'JWT',
        alg: 'ES256'
      };
      var tokenBody = {
        aud: audience,
        exp: exp,
        sub: subject
      }; // Utility function for UTF-8 encoding a string to an ArrayBuffer.

      var utf8Encoder = new TextEncoder('utf-8'); // The unsigned token is the concatenation of the URL-safe base64 encoded
      // header and body.

      var unsignedToken = window.uint8ArrayToBase64Url(utf8Encoder.encode(JSON.stringify(tokenHeader))) + '.' + window.uint8ArrayToBase64Url(utf8Encoder.encode(JSON.stringify(tokenBody))); // Sign the |unsignedToken| using ES256 (SHA-256 over ECDSA).

      var keyData = {
        kty: 'EC',
        crv: 'P-256',
        x: window.uint8ArrayToBase64Url(publicApplicationServerKey.subarray(1, 33)),
        y: window.uint8ArrayToBase64Url(publicApplicationServerKey.subarray(33, 65)),
        d: window.uint8ArrayToBase64Url(privateApplicationServerKey)
      }; // Sign the |unsignedToken| with the server's private key to generate
      // the signature.

      var key = yield crypto.subtle.importKey('jwk', keyData, {
        name: 'ECDSA',
        namedCurve: 'P-256'
      }, true, ['sign']);
      var signature = yield crypto.subtle.sign({
        name: 'ECDSA',
        hash: {
          name: 'SHA-256'
        }
      }, key, utf8Encoder.encode(unsignedToken));
      var jsonWebToken = unsignedToken + '.' + window.uint8ArrayToBase64Url(new Uint8Array(signature));
      var p256ecdsa = window.uint8ArrayToBase64Url(publicApplicationServerKey);
      return {
        Authorization: "vapid t=".concat(jsonWebToken, ", k=").concat(p256ecdsa)
      };
    })();
  }

}

if (typeof window !== 'undefined') {
  window.gauntface = window.gauntface || {};
  window.gauntface.VapidHelper2 = VapidHelper2;
}