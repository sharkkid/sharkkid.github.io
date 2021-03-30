"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

/* eslint-env browser */

/* global HKDF */
class EncryptionHelperAESGCM {
  constructor() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    this._b64ServerKeys = options.serverKeys;
    this._b64Salt = options.salt;
    this._b4VapidKeys = options.vapidKeys;
  }

  getServerKeys() {
    if (this._b64ServerKeys) {
      return window.arrayBuffersToCryptoKeys(window.base64UrlToUint8Array(this._b64ServerKeys.publicKey), window.base64UrlToUint8Array(this._b64ServerKeys.privateKey));
    }

    return EncryptionHelperAESGCM.generateServerKeys();
  }

  getSalt() {
    if (this._b64Salt) {
      return window.base64UrlToUint8Array(this._b64Salt);
    }

    return window.generateSalt();
  }

  getVapidKeys() {
    if (this._b4VapidKeys) {
      return this._b4VapidKeys;
    }

    return window.gauntface.CONSTANTS.APPLICATION_KEYS;
  }

  getRequestDetails(subscription, payloadText) {
    var _this = this;

    return _asyncToGenerator(function* () {
      var vapidHeaders = yield window.gauntface.VapidHelper1.createVapidAuthHeader(_this.getVapidKeys(), subscription.endpoint, 'mailto:simple-push-demo@gauntface.co.uk');
      var encryptedPayloadDetails = yield _this.encryptPayload(subscription, payloadText);
      var body = null;
      var headers = {};
      headers.TTL = 60;

      if (encryptedPayloadDetails) {
        body = encryptedPayloadDetails.cipherText;
        headers.Encryption = "salt=".concat(encryptedPayloadDetails.salt);
        headers['Crypto-Key'] = "dh=".concat(encryptedPayloadDetails.publicServerKey);
        headers['Content-Encoding'] = 'aesgcm';
      } else {
        headers['Content-Length'] = 0;
      }

      if (vapidHeaders) {
        Object.keys(vapidHeaders).forEach(headerName => {
          if (headers[headerName]) {
            headers[headerName] = "".concat(headers[headerName], "; ").concat(vapidHeaders[headerName]);
          } else {
            headers[headerName] = vapidHeaders[headerName];
          }
        });
      }

      var response = {
        headers: headers,
        endpoint: subscription.endpoint
      };

      if (body) {
        response.body = body;
      }

      return response;
    })();
  }

  encryptPayload(subscription, payloadText) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      if (!payloadText || payloadText.trim().length === 0) {
        return Promise.resolve(null);
      }

      var salt = _this2.getSalt();

      var serverKeys = yield _this2.getServerKeys();
      var exportedServerKeys = yield window.cryptoKeysToUint8Array(serverKeys.publicKey);
      var encryptionKeys = yield _this2._generateEncryptionKeys(subscription, salt, serverKeys);
      var contentEncryptionCryptoKey = yield crypto.subtle.importKey('raw', encryptionKeys.contentEncryptionKey, 'AES-GCM', true, ['decrypt', 'encrypt']);
      encryptionKeys.contentEncryptionCryptoKey = contentEncryptionCryptoKey;
      var paddingBytes = 0;
      var paddingUnit8Array = new Uint8Array(2 + paddingBytes);
      var utf8Encoder = new TextEncoder('utf-8');
      var payloadUint8Array = utf8Encoder.encode(payloadText);
      var recordUint8Array = new Uint8Array(paddingUnit8Array.byteLength + payloadUint8Array.byteLength);
      recordUint8Array.set(paddingUnit8Array, 0);
      recordUint8Array.set(payloadUint8Array, paddingUnit8Array.byteLength);
      var algorithm = {
        name: 'AES-GCM',
        tagLength: 128,
        iv: encryptionKeys.nonce
      };
      var encryptedPayloadArrayBuffer = yield crypto.subtle.encrypt(algorithm, encryptionKeys.contentEncryptionCryptoKey, recordUint8Array);
      return {
        cipherText: encryptedPayloadArrayBuffer,
        salt: window.uint8ArrayToBase64Url(salt),
        publicServerKey: window.uint8ArrayToBase64Url(exportedServerKeys.publicKey)
      };
    })();
  }

  static generateServerKeys() {
    // 'true' is to make the keys extractable
    return crypto.subtle.generateKey({
      name: 'ECDH',
      namedCurve: 'P-256'
    }, true, ['deriveBits']);
  }

  _generateEncryptionKeys(subscription, salt, serverKeys) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      var results = yield Promise.all([_this3._generatePRK(subscription, serverKeys), _this3._generateCEKInfo(subscription, serverKeys), _this3._generateNonceInfo(subscription, serverKeys)]);
      var prk = results[0];
      var cekInfo = results[1];
      var nonceInfo = results[2];
      var cekHKDF = new HKDF(prk, salt);
      var nonceHKDF = new HKDF(prk, salt);
      var finalKeys = yield Promise.all([cekHKDF.generate(cekInfo, 16), nonceHKDF.generate(nonceInfo, 12)]);
      return {
        contentEncryptionKey: finalKeys[0],
        nonce: finalKeys[1]
      };
    })();
  }

  _generateContext(subscription, serverKeys) {
    return _asyncToGenerator(function* () {
      var cryptoKeys = yield window.arrayBuffersToCryptoKeys(subscription.getKey('p256dh'));
      var keysAsCryptoKeys = {
        clientPublicKey: cryptoKeys.publicKey,
        serverPublicKey: serverKeys.publicKey
      };
      var keysAsUint8 = yield Promise.all([window.cryptoKeysToUint8Array(keysAsCryptoKeys.clientPublicKey), window.cryptoKeysToUint8Array(keysAsCryptoKeys.serverPublicKey)]);
      var keys = {
        clientPublicKey: keysAsUint8[0].publicKey,
        serverPublicKey: keysAsUint8[1].publicKey
      };
      var utf8Encoder = new TextEncoder('utf-8');
      var labelUnit8Array = utf8Encoder.encode('P-256');
      var paddingUnit8Array = new Uint8Array(1).fill(0);
      var clientPublicKeyLengthUnit8Array = new Uint8Array(2);
      clientPublicKeyLengthUnit8Array[0] = 0x00;
      clientPublicKeyLengthUnit8Array[1] = keys.clientPublicKey.byteLength;
      var serverPublicKeyLengthBuffer = new Uint8Array(2);
      serverPublicKeyLengthBuffer[0] = 0x00;
      serverPublicKeyLengthBuffer[1] = keys.serverPublicKey.byteLength;
      return window.joinUint8Arrays([labelUnit8Array, paddingUnit8Array, clientPublicKeyLengthUnit8Array, keys.clientPublicKey, serverPublicKeyLengthBuffer, keys.serverPublicKey]);
    })();
  }

  _generateCEKInfo(subscription, serverKeys) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      var utf8Encoder = new TextEncoder('utf-8');
      var contentEncoding8Array = utf8Encoder.encode('Content-Encoding: aesgcm');
      var paddingUnit8Array = new Uint8Array(1).fill(0);
      var contextBuffer = yield _this4._generateContext(subscription, serverKeys);
      return window.joinUint8Arrays([contentEncoding8Array, paddingUnit8Array, contextBuffer]);
    })();
  }

  _generateNonceInfo(subscription, serverKeys) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      var utf8Encoder = new TextEncoder('utf-8');
      var contentEncoding8Array = utf8Encoder.encode('Content-Encoding: nonce');
      var paddingUnit8Array = new Uint8Array(1).fill(0);
      var contextBuffer = yield _this5._generateContext(subscription, serverKeys);
      return window.joinUint8Arrays([contentEncoding8Array, paddingUnit8Array, contextBuffer]);
    })();
  }

  _generatePRK(subscription, serverKeys) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      var sharedSecret = yield _this6._getSharedSecret(subscription, serverKeys);
      var utf8Encoder = new TextEncoder('utf-8');
      var authInfoUint8Array = utf8Encoder.encode('Content-Encoding: auth\0');
      var hkdf = new HKDF(sharedSecret, subscription.getKey('auth'));
      return hkdf.generate(authInfoUint8Array, 32);
    })();
  }

  _getSharedSecret(subscription, serverKeys) {
    return _asyncToGenerator(function* () {
      var keys = yield window.arrayBuffersToCryptoKeys(subscription.getKey('p256dh'));

      if (!(keys.publicKey instanceof CryptoKey)) {
        throw new Error('The publicKey must be a CryptoKey.');
      }

      var algorithm = {
        name: 'ECDH',
        namedCurve: 'P-256',
        public: keys.publicKey
      };
      return crypto.subtle.deriveBits(algorithm, serverKeys.privateKey, 256);
    })();
  }

}

if (typeof window !== 'undefined') {
  window.gauntface = window.gauntface || {};
  window.gauntface.EncryptionHelperAESGCM = EncryptionHelperAESGCM;
}