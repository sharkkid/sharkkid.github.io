'use strict';
/* eslint-env browser, serviceworker */

/* globals idbKeyval */
// Make use of Google Analytics Measurement Protocol.
// https://developers.google.com/analytics/devguides/collection/protocol/v1/reference

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

class Analytics {
  trackEvent(eventAction, eventValue, optionalParams) {
    var _this = this;

    return _asyncToGenerator(function* () {
      if (!_this.trackingId) {
        console.error('You need to set a trackingId, for example:');
        console.error('self.analytics.trackingId = \'UA-XXXXXXXX-X\';'); // We want this to be a safe method, so avoid throwing Unless
        // It's absolutely necessary.

        return;
      }

      if (typeof eventAction === 'undefined' && typeof eventValue === 'undefined') {
        console.warn('sendAnalyticsEvent() called with no eventAction or ' + 'eventValue.');
        return;
      }

      try {
        var clientId = yield _this.getClientID();

        if (!clientId) {
          var subscription = yield self.registration.getSubscription();

          if (!subscription) {
            throw new Error('No Google Analytics Client ID and No ' + 'Push subscription.');
          }

          clientId = subscription.endpoint;
        }

        var payloadData = {
          // Version Number
          v: 1,
          // Client ID
          cid: clientId,
          // Tracking ID
          tid: _this.trackingId,
          // Hit Type
          t: 'event',
          // Data Source
          ds: 'serviceworker',
          // Event Category
          ec: 'serviceworker',
          // Event Action
          ea: eventAction,
          // Event Value
          ev: eventValue
        };

        if (optionalParams) {
          Object.keys(optionalParams).forEach(key => {
            payloadData[key] = optionalParams[key];
          });
        }

        var payloadString = Object.keys(payloadData).filter(analyticsKey => {
          return payloadData[analyticsKey];
        }).map(analyticsKey => {
          return "".concat(analyticsKey, "=") + encodeURIComponent(payloadData[analyticsKey]);
        }).join('&');
        var response = yield fetch('https://www.google-analytics.com/collect', {
          method: 'post',
          body: payloadString
        });

        if (!response.ok) {
          var responseText = yield response.text();
          throw new Error("Bad response from Google Analytics " + "[".concat(response.status, "] ").concat(responseText));
        }
      } catch (err) {
        console.warn('Unable to send the analytics event', err);
      }
    })();
  }

  getClientID() {
    return idbKeyval.get('google-analytics-client-id').catch(() => {
      return null;
    });
  }

}

if (typeof self !== 'undefined') {
  self.analytics = new Analytics();
}