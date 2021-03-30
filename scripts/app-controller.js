"use strict";

/* global PushClient, MaterialComponentsSnippets */

/* eslint-env browser */
var BACKEND_ORIGIN = "https://simple-push-demo.appspot.com"; // const BACKEND_ORIGIN = `http://localhost:8080`;

class AppController {
  constructor() {
    this._encryptionHelper = window.gauntface.EncryptionHelperFactory.generateHelper();
    var contentEncodingCode = document.querySelector('.js-supported-content-encodings');
    contentEncodingCode.textContent = JSON.stringify(PushManager.supportedContentEncodings || ['aesgcm'], null, 2); // This div contains the UI for CURL commands to trigger a push

    this._sendPushOptions = document.querySelector('.js-send-push-options');
    this._subscriptionJSONCode = document.querySelector('.js-subscription-json');
    this._payloadTextField = document.querySelector('.js-payload-textfield');

    this._payloadTextField.oninput = () => {
      this.updatePushInfo();
    }; // Below this comment is code to initialise a material design lite view.


    var toggleSwitch = document.querySelector('.js-push-toggle-switch');

    if (toggleSwitch.classList.contains('is-upgraded')) {
      this.ready = Promise.resolve();

      this._uiInitialised(toggleSwitch.MaterialSwitch);
    } else {
      this.ready = new Promise(resolve => {
        var mdlUpgradeCb = () => {
          if (!toggleSwitch.classList.contains('is-upgraded')) {
            return;
          }

          this._uiInitialised(toggleSwitch.MaterialSwitch);

          document.removeEventListener(mdlUpgradeCb);
          resolve();
        }; // This is to wait for MDL initialising


        document.addEventListener('mdl-componentupgraded', mdlUpgradeCb);
      });
    }
  }

  _uiInitialised(toggleSwitch) {
    this._stateChangeListener = this._stateChangeListener.bind(this);
    this._subscriptionUpdate = this._subscriptionUpdate.bind(this);
    this._toggleSwitch = toggleSwitch;
    this._pushClient = new PushClient(this._stateChangeListener, this._subscriptionUpdate, window.gauntface.CONSTANTS.APPLICATION_KEYS.publicKey);
    document.querySelector('.js-push-toggle-switch > input').addEventListener('click', event => {
      // Inverted because clicking will change the checked state by
      // the time we get here
      if (event.target.checked) {
        this._pushClient.subscribeDevice();
      } else {
        this._pushClient.unsubscribeDevice();
      }
    });
    var sendPushViaXHRButton = document.querySelector('.js-send-push-button');
    sendPushViaXHRButton.addEventListener('click', () => {
      if (this._currentSubscription) {
        this.sendPushMessage(this._currentSubscription, this._payloadTextField.value);
      }
    }); // allow snippets to be copied via click

    new MaterialComponentsSnippets().init();
  }

  registerServiceWorker() {
    // Check that service workers are supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        this.showErrorMessage('Unable to Register SW', 'Sorry this demo requires a service worker to work and it ' + 'failed to install - sorry :(');
        console.error(err);
      });
    } else {
      this.showErrorMessage('Service Worker Not Supported', 'Sorry this demo requires service worker support in your browser. ' + 'Please try this demo in Chrome or Firefox Nightly.');
    }
  }

  _stateChangeListener(state, data) {
    if (typeof state.interactive !== 'undefined') {
      if (state.interactive) {
        this._toggleSwitch.enable();
      } else {
        this._toggleSwitch.disable();
      }
    }

    if (typeof state.pushEnabled !== 'undefined') {
      if (state.pushEnabled) {
        this._toggleSwitch.on();
      } else {
        this._toggleSwitch.off();
      }
    }

    switch (state.id) {
      case 'UNSUPPORTED':
        this.showErrorMessage('Push Not Supported', data);
        break;

      case 'ERROR':
        this.showErrorMessage('Ooops a Problem Occurred', data);
        break;

      default:
        break;
    }
  }

  _subscriptionUpdate(subscription) {
    this._currentSubscription = subscription;

    if (!subscription) {
      // Remove any subscription from your servers if you have
      // set it up.
      this._sendPushOptions.style.opacity = 0;
      return;
    }

    this._subscriptionJSONCode.textContent = JSON.stringify(subscription, null, 2); // This is too handle old versions of Firefox where keys would exist
    // but auth wouldn't

    var payloadTextfieldContainer = document.querySelector('.js-payload-textfield-container');
    var subscriptionObject = JSON.parse(JSON.stringify(subscription));

    if (subscriptionObject && subscriptionObject.keys && subscriptionObject.keys.auth && subscriptionObject.keys.p256dh) {
      payloadTextfieldContainer.classList.remove('hidden');
    } else {
      payloadTextfieldContainer.classList.add('hidden');
    }

    this.updatePushInfo(); // Display the UI

    this._sendPushOptions.style.opacity = 1;
  }

  updatePushInfo() {
    // Let's look at payload
    var payloadText = this._payloadTextField.value;
    return this._encryptionHelper.getRequestDetails(this._currentSubscription, payloadText).then(requestDetails => {
      var curlCommand = "curl \"".concat(requestDetails.endpoint, "\" --request POST");
      var curlError = null;
      document.querySelector('.js-endpoint').textContent = requestDetails.endpoint;
      var headersList = document.querySelector('.js-headers-list');

      while (headersList.hasChildNodes()) {
        headersList.removeChild(headersList.firstChild);
      }

      Object.keys(requestDetails.headers).forEach(header => {
        var liElement = document.createElement('p');
        liElement.innerHTML = "<span>".concat(header, "</span>: ") + "".concat(requestDetails.headers[header]);
        headersList.appendChild(liElement);
        curlCommand += " --header \"".concat(header, ": ").concat(requestDetails.headers[header], "\"");
      });
      var bodyFormat = document.querySelector('.js-body-format');
      var bodyContent = document.querySelector('.js-body-content');

      if (requestDetails.body && requestDetails.body instanceof ArrayBuffer) {
        bodyFormat.textContent = 'Stream';
        bodyContent.textContent = 'Unable to display';
        curlCommand = null;
        curlError = 'Sorry, but because the web push ' + 'protocol requires a stream as the body of the request, ' + 'there is no CURL command that will stream an encrypted payload.';
      } else if (requestDetails.body) {
        bodyFormat.textContent = 'String';
        bodyContent.textContent = requestDetails.body;
        curlCommand += " -d ".concat(JSON.stringify(requestDetails.body));
      } else {
        bodyFormat.textContent = 'No Body';
        bodyContent.textContent = 'N/A';
      }

      var curlCodeElement = document.querySelector('.js-curl-code');
      var curlMsgElement = document.querySelector('.js-curl-copy-msg');
      var curlErrorMsgElement = document.querySelector('.js-curl-error-msg');

      if (curlCommand === null) {
        curlCodeElement.style.display = 'none';
        curlMsgElement.style.display = 'none';
        curlErrorMsgElement.textContent = curlError;
        curlErrorMsgElement.style.display = 'block';
      } else {
        curlCodeElement.textContent = curlCommand;
        curlCodeElement.style.display = 'block';
        curlMsgElement.style.display = 'block';
        curlErrorMsgElement.style.display = 'none';
      }
    });
  }

  getGCMInfo(subscription, payload, apiKey) {
    var headers = {};
    headers.Authorization = "key=".concat(apiKey);
    headers['Content-Type'] = "application/json";
    var endpointSections = subscription.endpoint.split('/');
    var subscriptionId = endpointSections[endpointSections.length - 1];
    var gcmAPIData = {
      to: subscriptionId
    };

    if (payload) {
      gcmAPIData['raw_data'] = this.toBase64(payload.cipherText); // eslint-disable-line

      headers.Encryption = "salt=".concat(payload.salt);
      headers['Crypto-Key'] = "dh=".concat(payload.publicServerKey);
      headers['Content-Encoding'] = payload.contentEncoding;
    }

    return {
      headers: headers,
      body: JSON.stringify(gcmAPIData),
      endpoint: 'https://android.googleapis.com/gcm/send'
    };
  }

  sendPushMessage(subscription, payloadText) {
    return this._encryptionHelper.getRequestDetails(this._currentSubscription, payloadText).then(requestDetails => {
      // Some push services don't allow CORS so have to forward
      // it to a different server to make the request which does support
      // CORs
      return this.sendRequestToProxyServer(requestDetails);
    });
  }

  sendRequestToProxyServer(requestInfo) {
    console.log('Sending XHR Proxy Server', requestInfo);
    var fetchOptions = {
      method: 'post'
    }; // Can't send a stream like is needed for web push protocol,
    // so needs to convert it to base 64 here and the server will
    // convert back and pass as a stream

    if (requestInfo.body && requestInfo.body instanceof ArrayBuffer) {
      requestInfo.body = this.toBase64(requestInfo.body);
      fetchOptions.body = requestInfo;
    }

    fetchOptions.body = JSON.stringify(requestInfo);
    fetch("".concat(BACKEND_ORIGIN, "/api/v2/sendpush"), fetchOptions).then(function (response) {
      if (response.status >= 400 && response.status < 500) {
        return response.text().then(responseText => {
          console.log('Failed web push response: ', response, response.status);
          throw new Error("Failed to send push message via web push protocol: " + "<pre>".concat(encodeURI(responseText), "</pre>"));
        });
      }
    }).catch(err => {
      console.log(err);
      this.showErrorMessage('Ooops Unable to Send a Push', err);
    });
  }

  toBase64(arrayBuffer, start, end) {
    start = start || 0;
    end = end || arrayBuffer.byteLength;
    var partialBuffer = new Uint8Array(arrayBuffer.slice(start, end));
    return btoa(String.fromCharCode.apply(null, partialBuffer));
  }

  showErrorMessage(title, message) {
    var errorContainer = document.querySelector('.js-error-message-container');
    var titleElement = errorContainer.querySelector('.js-error-title');
    var messageElement = errorContainer.querySelector('.js-error-message');
    titleElement.textContent = title;
    messageElement.innerHTML = message;
    errorContainer.style.opacity = 1;
    var pushOptionsContainer = document.querySelector('.js-send-push-options');
    pushOptionsContainer.style.display = 'none';
  }

}

if (window) {
  window.onload = function () {
    if (!navigator.serviceWorker) {
      console.warn('Service worker not supported.');
      return;
    }

    if (!('PushManager' in window)) {
      console.warn('Push not supported.');
      return;
    }

    var appController = new AppController();
    appController.ready.then(() => {
      document.body.dataset.simplePushDemoLoaded = true;
      var host = 'gauntface.github.io';

      if (window.location.host === host && window.location.protocol !== 'https:') {
        // Enforce HTTPS
        window.location.protocol = 'https';
      }

      appController.registerServiceWorker();
    });
  };
}