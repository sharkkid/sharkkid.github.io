/* global HMAC */

/* eslint-env browser */
'use strict';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

class HKDF {
  constructor(ikm, salt) {
    this._ikm = ikm;
    this._salt = salt;
    this._hmac = new HMAC(salt);
  }

  generate(info, byteLength) {
    var _this = this;

    return _asyncToGenerator(function* () {
      var fullInfoBuffer = new Uint8Array(info.byteLength + 1);
      fullInfoBuffer.set(info, 0);
      fullInfoBuffer.set(new Uint8Array(1).fill(1), info.byteLength);
      var prk = yield _this._hmac.sign(_this._ikm);
      var nextHmac = new HMAC(prk);
      var nextPrk = yield nextHmac.sign(fullInfoBuffer);
      return nextPrk.slice(0, byteLength);
    })();
  }

}

if (typeof window !== 'undefined') {
  window.gauntface = window.gauntface || {};
  window.gauntface.HKDF = HKDF;
} else if (module && module.exports) {
  module.exports = HKDF;
}