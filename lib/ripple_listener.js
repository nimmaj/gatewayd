var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Client = require('ripple-rest-client');
var config = require(__dirname+'/../config/environment');
var api = require(__dirname+'/api.js');

var client = new Client({
  api: config.get('RIPPLE_REST_API'),
  account: config.get('COLD_WALLET'),
  secret: ''
});

var vent = new EventEmitter();
function pollForPayments(hash, callback) {
  client.getNotification(hash, function(error, notification) {
    if (error) {
      logger.error('payment:incoming:error', error);
      setTimeout(function(){
        callback(hash, pollForPayments);
      }, 500);
      return;
    }
    if (notification && notification.next_notification_hash) {
      client.getPayment(notification.next_notification_hash, function(error, payment) {
        if (error) {
          logger.error('payment:incoming:error', error);
          setTimeout(function(){
            callback(hash, pollForPayments);
          }, 500);
        } else {
          vent.emit('payment', payment);
          if (payment) {
            api.getColdWallet(function(error, address) {
              address.setLastPaymentHash(payment.hash).then(function() {
                callback(notification.next_notification_hash, pollForPayments);
              }).error(function() {
                callback(notification.next_notification_hash, pollForPayments);
              });
            });
          } else {
            callback(notification.next_notification_hash, pollForPayments);
          }
        }
      });
    } else {
      setTimeout(function(){
        callback(hash, pollForPayments);
      }, 500);
    }
  });
}

function Listener() {}
util.inherits(Listener, EventEmitter);
Listener.prototype.start = function(hash) {
  var listener = this;
  vent.on('payment', function(payment) {
    listener.onPayment(payment);
  });
  pollForPayments(hash, pollForPayments);
};

module.exports = Listener;

