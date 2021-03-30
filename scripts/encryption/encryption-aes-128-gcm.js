"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

/* eslint-env browser */

/* global HKDF */
class EncryptionHelperAES128GCM {
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

    return EncryptionHelperAES128GCM.generateServerKeys();
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
    var vapidHelper = window.gauntface.VapidHelper1;
    var endpoint = subscription.endpoint; // Latest spec changes for VAPID is implemented on this custom FCM
    // endpoint. This is experimental and SHOULD NOT BE USED IN PRODUCTION
    // web apps.
    //
    // Need to get a proper feature detect in place for these vapid changes
    // https://github.com/mozilla-services/autopush/issues/879

    if (endpoint.indexOf('https://fcm.googleapis.com') === 0) {
      endpoint = endpoint.replace('fcm/send', 'wp');
      vapidHelper = window.gauntface.VapidHelper2;
    }

    return vapidHelper.createVapidAuthHeader(this.getVapidKeys(), subscription.endpoint, 'mailto:simple-push-demo@gauntface.co.uk').then(vapidHeaders => {
      return this.encryptPayload(subscription, payloadText).then(encryptedPayloadDetails => {
        var body = null;
        var headers = {};
        headers.TTL = 60;

        if (encryptedPayloadDetails) {
          body = encryptedPayloadDetails.cipherText;
          headers['Content-Encoding'] = 'aes128gcm';
        } else {
          headers['Content-Length'] = 0;
        }

        if (vapidHeaders) {
          Object.keys(vapidHeaders).forEach(headerName => {
            headers[headerName] = vapidHeaders[headerName];
          });
        }

        var response = {
          headers: headers,
          endpoint
        };

        if (body) {
          response.body = body;
        }

        return Promise.resolve(response);
      });
    });
  }

  encryptPayload(subscription, payloadText) {
    var _this = this;

    return _asyncToGenerator(function* () {
      if (!payloadText || payloadText.trim().length === 0) {
        return Promise.resolve(null);
      }

      var salt = _this.getSalt();

      var serverKeys = yield _this.getServerKeys();
      var exportedServerKeys = yield window.cryptoKeysToUint8Array(serverKeys.publicKey);
      var encryptionKeys = yield _this._generateEncryptionKeys(subscription, salt, serverKeys);
      var contentEncryptionCryptoKey = yield crypto.subtle.importKey('raw', encryptionKeys.contentEncryptionKey, 'AES-GCM', true, ['decrypt', 'encrypt']);
      encryptionKeys.contentEncryptionCryptoKey = contentEncryptionCryptoKey;
      var utf8Encoder = new TextEncoder('utf-8');
      var payloadUint8Array = utf8Encoder.encode(payloadText);
      var paddingBytes = 0;
      var paddingUnit8Array = new Uint8Array(1 + paddingBytes);
      paddingUnit8Array.fill(0);
      paddingUnit8Array[0] = 0x02;
      var recordUint8Array = window.joinUint8Arrays([payloadUint8Array, paddingUnit8Array]);
      var algorithm = {
        name: 'AES-GCM',
        tagLength: 128,
        iv: encryptionKeys.nonce
      };
      var encryptedPayloadArrayBuffer = yield crypto.subtle.encrypt(algorithm, encryptionKeys.contentEncryptionCryptoKey, recordUint8Array);
      var payloadWithHeaders = yield _this._addEncryptionContentCodingHeader(encryptedPayloadArrayBuffer, serverKeys, salt);
      return {
        cipherText: payloadWithHeaders,
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

  _addEncryptionContentCodingHeader(encryptedPayloadArrayBuffer, serverKeys, salt) {
    return _asyncToGenerator(function* () {
      var keys = yield window.cryptoKeysToUint8Array(serverKeys.publicKey); // Maximum record size.

      var recordSizeUint8Array = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
      var serverPublicKeyLengthBuffer = new Uint8Array(1);
      serverPublicKeyLengthBuffer[0] = keys.publicKey.byteLength;
      var uint8arrays = [salt, // Record Size
      recordSizeUint8Array, // Service Public Key Length
      serverPublicKeyLengthBuffer, // Server Public Key
      keys.publicKey, new Uint8Array(encryptedPayloadArrayBuffer)];
      var joinedUint8Array = window.joinUint8Arrays(uint8arrays);
      return joinedUint8Array.buffer;
    })();
  }

  _generateEncryptionKeys(subscription, salt, serverKeys) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      var infoResults = yield Promise.all([_this2._generatePRK(subscription, serverKeys), _this2._generateCEKInfo(subscription, serverKeys), _this2._generateNonceInfo(subscription, serverKeys)]);
      var prk = infoResults[0];
      var cekInfo = infoResults[1];
      var nonceInfo = infoResults[2];
      var cekHKDF = new HKDF(prk, salt);
      var nonceHKDF = new HKDF(prk, salt);
      var keyResults = yield Promise.all([cekHKDF.generate(cekInfo, 16), nonceHKDF.generate(nonceInfo, 12)]);
      return {
        contentEncryptionKey: keyResults[0],
        nonce: keyResults[1]
      };
    })();
  }

  _generateCEKInfo(subscription, serverKeys) {
    var utf8Encoder = new TextEncoder('utf-8');
    var contentEncoding8Array = utf8Encoder.encode('Content-Encoding: aes128gcm');
    var paddingUnit8Array = new Uint8Array(1).fill(0);
    return window.joinUint8Arrays([contentEncoding8Array, paddingUnit8Array]);
  }

  _generateNonceInfo(subscription, serverKeys) {
    var utf8Encoder = new TextEncoder('utf-8');
    var contentEncoding8Array = utf8Encoder.encode('Content-Encoding: nonce');
    var paddingUnit8Array = new Uint8Array(1).fill(0);
    return window.joinUint8Arrays([contentEncoding8Array, paddingUnit8Array]);
  }

  _generatePRK(subscription, serverKeys) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      var sharedSecret = yield _this3._getSharedSecret(subscription, serverKeys);
      var keyInfoUint8Array = yield _this3._getKeyInfo(subscription, serverKeys);
      var hkdf = new HKDF(sharedSecret, subscription.getKey('auth'));
      return hkdf.generate(keyInfoUint8Array, 32);
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

  _getKeyInfo(subscription, serverKeys) {
    return _asyncToGenerator(function* () {
      var utf8Encoder = new TextEncoder('utf-8');
      var keyInfo = yield window.cryptoKeysToUint8Array(serverKeys.publicKey);
      return window.joinUint8Arrays([utf8Encoder.encode('WebPush: info'), new Uint8Array(1).fill(0), new Uint8Array(subscription.getKey('p256dh')), keyInfo.publicKey]);
    })();
  }

}

if (typeof window !== 'undefined') {
  window.gauntface = window.gauntface || {};
  window.gauntface.EncryptionHelperAES128GCM = EncryptionHelperAES128GCM;
}