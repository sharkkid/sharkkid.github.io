'use strict';
/* eslint-env browser */

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

class PushClient {
  constructor(stateChangeCb, subscriptionUpdate, publicAppKey) {
    this._stateChangeCb = stateChangeCb;
    this._subscriptionUpdate = subscriptionUpdate;
    this._publicApplicationKey = window.base64UrlToUint8Array(publicAppKey);
    this._state = {
      UNSUPPORTED: {
        id: 'UNSUPPORTED',
        interactive: false,
        pushEnabled: false
      },
      INITIALISING: {
        id: 'INITIALISING',
        interactive: false,
        pushEnabled: false
      },
      PERMISSION_DENIED: {
        id: 'PERMISSION_DENIED',
        interactive: false,
        pushEnabled: false
      },
      PERMISSION_GRANTED: {
        id: 'PERMISSION_GRANTED',
        interactive: true
      },
      PERMISSION_PROMPT: {
        id: 'PERMISSION_PROMPT',
        interactive: true,
        pushEnabled: false
      },
      ERROR: {
        id: 'ERROR',
        interactive: false,
        pushEnabled: false
      },
      STARTING_SUBSCRIBE: {
        id: 'STARTING_SUBSCRIBE',
        interactive: false,
        pushEnabled: true
      },
      SUBSCRIBED: {
        id: 'SUBSCRIBED',
        interactive: true,
        pushEnabled: true
      },
      STARTING_UNSUBSCRIBE: {
        id: 'STARTING_UNSUBSCRIBE',
        interactive: false,
        pushEnabled: false
      },
      UNSUBSCRIBED: {
        id: 'UNSUBSCRIBED',
        interactive: true,
        pushEnabled: false
      }
    };

    if (!('serviceWorker' in navigator)) {
      this._stateChangeCb(this._state.UNSUPPORTED, 'Service worker not ' + 'available on this browser');

      return;
    }

    if (!('PushManager' in window)) {
      this._stateChangeCb(this._state.UNSUPPORTED, 'PushManager not ' + 'available on this browser');

      return;
    }

    if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
      this._stateChangeCb(this._state.UNSUPPORTED, 'Showing Notifications ' + 'from a service worker is not available on this browser');

      return;
    }

    navigator.serviceWorker.ready.then(() => {
      this._stateChangeCb(this._state.INITIALISING);

      this.setUpPushPermission();
    });
  }

  _permissionStateChange(permissionState) {
    // If the notification permission is denied, it's a permanent block
    switch (permissionState) {
      case 'denied':
        this._stateChangeCb(this._state.PERMISSION_DENIED);

        break;

      case 'granted':
        this._stateChangeCb(this._state.PERMISSION_GRANTED);

        break;

      case 'default':
        this._stateChangeCb(this._state.PERMISSION_PROMPT);

        break;

      default:
        console.error('Unexpected permission state: ', permissionState);
        break;
    }
  }

  setUpPushPermission() {
    var _this = this;

    return _asyncToGenerator(function* () {
      try {
        _this._permissionStateChange(Notification.permission);

        var reg = yield navigator.serviceWorker.ready; // Let's see if we have a subscription already

        var subscription = yield reg.pushManager.getSubscription();

        if (!subscription) {
          // NOOP since we have no subscription and the permission state
          // will inform whether to enable or disable the push UI
          return;
        }

        _this._stateChangeCb(_this._state.SUBSCRIBED); // Update the current state with the
        // subscriptionid and endpoint


        _this._subscriptionUpdate(subscription);
      } catch (err) {
        console.log('setUpPushPermission() ', err);

        _this._stateChangeCb(_this._state.ERROR, err);
      }
    })();
  }

  subscribeDevice() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      _this2._stateChangeCb(_this2._state.STARTING_SUBSCRIBE);

      try {
        switch (Notification.permission) {
          case 'denied':
            throw new Error('Push messages are blocked.');

          case 'granted':
            break;

          default:
            yield new Promise((resolve, reject) => {
              Notification.requestPermission(result => {
                if (result !== 'granted') {
                  reject(new Error('Bad permission result'));
                }

                resolve();
              });
            });
        } // We need the service worker registration to access the push manager


        try {
          var reg = yield navigator.serviceWorker.ready;
          var subscription = yield reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: _this2._publicApplicationKey
          });

          _this2._stateChangeCb(_this2._state.SUBSCRIBED);

          _this2._subscriptionUpdate(subscription);
        } catch (err) {
          _this2._stateChangeCb(_this2._state.ERROR, err);
        }
      } catch (err) {
        console.log('subscribeDevice() ', err); // Check for a permission prompt issue

        _this2._permissionStateChange(Notification.permission);
      }
    })();
  }

  unsubscribeDevice() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      // Disable the switch so it can't be changed while
      // we process permissions
      // window.PushDemo.ui.setPushSwitchDisabled(true);
      _this3._stateChangeCb(_this3._state.STARTING_UNSUBSCRIBE);

      try {
        var reg = yield navigator.serviceWorker.ready;
        var subscription = yield reg.pushManager.getSubscription(); // Check we have everything we need to unsubscribe

        if (!subscription) {
          _this3._stateChangeCb(_this3._state.UNSUBSCRIBED);

          _this3._subscriptionUpdate(null);

          return;
        } // You should remove the device details from the server
        // i.e. the  pushSubscription.endpoint


        var successful = yield subscription.unsubscribe();

        if (!successful) {
          // The unsubscribe was unsuccessful, but we can
          // remove the subscriptionId from our server
          // and notifications will stop
          // This just may be in a bad state when the user returns
          console.error('We were unable to unregister from push');
        }

        _this3._stateChangeCb(_this3._state.UNSUBSCRIBED);

        _this3._subscriptionUpdate(null);
      } catch (err) {
        console.error('Error thrown while revoking push notifications. ' + 'Most likely because push was never registered', err);
      }
    })();
  }

}

if (window) {
  window.PushClient = PushClient;
}