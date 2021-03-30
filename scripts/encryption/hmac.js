/* eslint-env browser */
'use strict';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

class HMAC {
  constructor(ikm) {
    this._ikm = ikm;
  }

  sign(input) {
    var _this = this;

    return _asyncToGenerator(function* () {
      var key = yield crypto.subtle.importKey('raw', _this._ikm, {
        name: 'HMAC',
        hash: 'SHA-256'
      }, false, ['sign']);
      return crypto.subtle.sign('HMAC', key, input);
    })();
  }

}

if (typeof window !== 'undefined') {
  window.gauntface = window.gauntface || {};
  window.gauntface.HMAC = HMAC;
} else if (module && module.exports) {
  module.exports = HMAC;
}