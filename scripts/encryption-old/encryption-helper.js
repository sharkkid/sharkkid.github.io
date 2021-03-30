"use strict";

/**
 * PLEASE NOTE: This is in no way complete. This is just enabling
 * some testing in the browser / on github pages.
 *
 * Massive H/T to Peter Beverloo for this.
 */

/* global HKDF */

/* eslint-env browser */
class EncryptionHelper {
  constructor(serverKeys, salt, vapidKeys) {
    if (!serverKeys || !serverKeys.publicKey || !serverKeys.privateKey) {
      throw new Error('Bad server keys. Use ' + 'EncryptionHelperFactory.generateKeys()');
    }

    if (!salt) {
      throw new Error('Bad salt value. Use ' + 'EncryptionHelperFactory.generateSalt()');
    }

    if (vapidKeys && (!vapidKeys.publicKey || !vapidKeys.privateKey)) {
      throw new Error('Bad VAPID keys. Use ' + 'EncryptionHelperFactory.generateVapidKeys()');
    }

    this._serverKeys = serverKeys;
    this._salt = salt;
    this._vapidKeys = vapidKeys;
  }

  get serverKeys() {
    return this._serverKeys;
  }

  get vapidKeys() {
    if (!this._vapidKeys) {
      return null;
    }

    return this._vapidKeys;
  }

  get salt() {
    return this._salt;
  }

  getSharedSecret(subscription) {
    return Promise.resolve().then(() => {
      return window.arrayBuffersToCryptoKeys(subscription.getKey('p256dh'));
    }).then(keys => {
      return keys.publicKey;
    }).then(publicKey => {
      if (!(publicKey instanceof CryptoKey)) {
        throw new Error('The publicKey must be a CryptoKey.');
      }

      var algorithm = {
        name: 'ECDH',
        namedCurve: 'P-256',
        public: publicKey
      };
      return crypto.subtle.deriveBits(algorithm, this.serverKeys.privateKey, 256);
    });
  }

  getKeyInfo(subscription) {
    var utf8Encoder = new TextEncoder('utf-8');
    return window.cryptoKeysToUint8Array(this.serverKeys.publicKey).then(uint8keys => {
      return window.joinUint8Arrays([utf8Encoder.encode('WebPush: info'), new Uint8Array(1).fill(0), new Uint8Array(subscription.getKey('p256dh')), uint8keys.publicKey]);
    });
  }

  generatePRK(subscription, contentEncoding) {
    return this.getSharedSecret(subscription).then(sharedSecret => {
      var utf8Encoder = new TextEncoder('utf-8');
      var authInfoUint8Array = utf8Encoder.encode('Content-Encoding: auth\0');
      var hkdf = new HKDF(sharedSecret, subscription.getKey('auth'));

      switch (contentEncoding) {
        case 'aesgcm':
          {
            return hkdf.generate(authInfoUint8Array, 32);
          }

        case 'aes128gcm':
          {
            return this.getKeyInfo(subscription).then(keyInfoUint8Array => {
              return hkdf.generate(keyInfoUint8Array, 32);
            });
          }

        default:
          {
            throw new Error("Unknown content encoding: '".concat(contentEncoding, "'"));
          }
      }
    });
  }

  generateContext(subscription) {
    return Promise.resolve().then(() => {
      return window.arrayBuffersToCryptoKeys(subscription.getKey('p256dh'));
    }).then(keys => {
      return window.cryptoKeysToUint8Array(keys.publicKey).then(keys => {
        return keys.publicKey;
      });
    }).then(clientPublicKey => {
      return window.cryptoKeysToUint8Array(this.serverKeys.publicKey).then(keys => {
        return {
          clientPublicKey: clientPublicKey,
          serverPublicKey: keys.publicKey
        };
      });
    }).then(keys => {
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
    });
  }

  generateCEKInfo(contextBuffer, subscription, contentEncoding) {
    return Promise.resolve().then(() => {
      var utf8Encoder = new TextEncoder('utf-8');
      var contentEncoding8Array = utf8Encoder.encode("Content-Encoding: ".concat(contentEncoding));
      var paddingUnit8Array = new Uint8Array(1).fill(0);
      var uint8Arrays = [contentEncoding8Array, paddingUnit8Array];

      if (contextBuffer) {
        uint8Arrays.push(contextBuffer);
      }

      return window.joinUint8Arrays(uint8Arrays);
    });
  }

  generateNonceInfo(contextBuffer, subscription) {
    return Promise.resolve().then(() => {
      var utf8Encoder = new TextEncoder('utf-8');
      var contentEncoding8Array = utf8Encoder.encode('Content-Encoding: nonce');
      var paddingUnit8Array = new Uint8Array(1).fill(0);
      var uint8Arrays = [contentEncoding8Array, paddingUnit8Array];

      if (contextBuffer) {
        uint8Arrays.push(contextBuffer);
      }

      return window.joinUint8Arrays(uint8Arrays);
    });
  }

  generateEncryptionKeys(subscription, contentEncoding) {
    var prkPromise = this.generatePRK(subscription, contentEncoding);
    var cekAndNoncePromise;

    switch (contentEncoding) {
      case 'aesgcm':
        {
          cekAndNoncePromise = this.generateContext(subscription).then(contextBuffer => {
            return Promise.all([this.generateCEKInfo(contextBuffer, subscription, contentEncoding), this.generateNonceInfo(contextBuffer, subscription)]);
          });
          break;
        }

      case 'aes128gcm':
        {
          cekAndNoncePromise = Promise.all([this.generateCEKInfo(null, subscription, contentEncoding), this.generateNonceInfo(null, subscription)]);
          break;
        }

      default:
        {
          throw new Error("Unknown content encoding: ".concat(contentEncoding));
        }
    }

    return Promise.all([prkPromise, cekAndNoncePromise]).then(results => {
      var prk = results[0];
      var cekInfo = results[1][0];
      var nonceInfo = results[1][1];
      var cekHKDF = new HKDF(prk, this._salt);
      var nonceHKDF = new HKDF(prk, this._salt);
      return Promise.all([cekHKDF.generate(cekInfo, 16), nonceHKDF.generate(nonceInfo, 12)]);
    }).then(results => {
      return {
        contentEncryptionKey: results[0],
        nonce: results[1]
      };
    });
  }

  addEncryptionContentCodingHeader(encryptedPayloadArrayBuffer) {
    return window.cryptoKeysToUint8Array(this.serverKeys.publicKey).then(keys => {
      var recordSizeBuffer = new ArrayBuffer(4);
      var recordSizeView = new DataView(recordSizeBuffer);
      recordSizeView.setUint32(0, encryptedPayloadArrayBuffer.byteLength);
      console.log(new Uint8Array(recordSizeBuffer));
      var serverPublicKeyLengthBuffer = new Uint8Array(2);
      serverPublicKeyLengthBuffer[0] = 0x00;
      serverPublicKeyLengthBuffer[1] = keys.publicKey.byteLength;
      var uint8arrays = [this.salt, // Record Size
      new Uint8Array(recordSizeBuffer), // Service Public Key Length
      serverPublicKeyLengthBuffer, // Server Public Key
      keys.publicKey, new Uint8Array(encryptedPayloadArrayBuffer)];
      var joinedUint8Array = window.joinUint8Arrays(uint8arrays);
      return joinedUint8Array.buffer;
    });
  }

  encryptMessage(subscription, payload) {
    var contentEncoding = 'aesgcm';

    if (PushManager.supportedContentEncodings) {
      contentEncoding = PushManager.supportedContentEncodings[0];
    }

    console.log('ENCODING WITH: ', contentEncoding);
    return this.generateEncryptionKeys(subscription, contentEncoding).then(encryptionKeys => {
      return crypto.subtle.importKey('raw', encryptionKeys.contentEncryptionKey, 'AES-GCM', true, ['decrypt', 'encrypt']).then(cekCryptoKey => {
        encryptionKeys.contentEncryptionCryptoKey = cekCryptoKey;
        return encryptionKeys;
      });
    }).then(encryptionKeys => {
      var utf8Encoder = new TextEncoder('utf-8');
      var recordUint8Array;

      switch (contentEncoding) {
        case 'aesgcm':
          {
            var paddingBytes = 0;
            var paddingUnit8Array = new Uint8Array(2 + paddingBytes);
            var payloadUint8Array = utf8Encoder.encode(payload);
            recordUint8Array = window.joinUint8Arrays([paddingUnit8Array, payloadUint8Array]);
            break;
          }

        case 'aes128gcm':
          {
            // Add a specific byte at the end of the payload data
            // https://tools.ietf.org/html/draft-ietf-httpbis-encryption-encoding-09#section-2
            var _paddingUnit8Array = new Uint8Array(1).fill(0x02);

            var _payloadUint8Array = utf8Encoder.encode(payload);

            recordUint8Array = window.joinUint8Arrays([_payloadUint8Array, _paddingUnit8Array]);
            break;
          }

        default:
          throw new Error("Unknown content encoding: '".concat(contentEncoding, "'"));
      }

      var algorithm = {
        name: 'AES-GCM',
        tagLength: 128,
        iv: encryptionKeys.nonce
      };
      return crypto.subtle.encrypt(algorithm, encryptionKeys.contentEncryptionCryptoKey, recordUint8Array);
    }).then(encryptedPayloadArrayBuffer => {
      switch (contentEncoding) {
        case 'aesgcm':
          {
            return encryptedPayloadArrayBuffer;
          }

        case 'aes128gcm':
          {
            return this.addEncryptionContentCodingHeader(encryptedPayloadArrayBuffer);
          }

        default:
          {
            throw new Error("Unknown content encoding: '".concat(contentEncoding, "'"));
          }
      }
    }).then(encryptedPayloadArrayBuffer => {
      return window.cryptoKeysToUint8Array(this.serverKeys.publicKey).then(keys => {
        return {
          contentEncoding: contentEncoding,
          cipherText: encryptedPayloadArrayBuffer,
          salt: window.uint8ArrayToBase64Url(this.salt),
          publicServerKey: window.uint8ArrayToBase64Url(keys.publicKey)
        };
      });
    });
  }

}

if (typeof window !== 'undefined') {
  window.gauntface = window.gauntface || {};
  window.gauntface.EncryptionHelper = EncryptionHelper;
}