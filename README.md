# iota payment module

## How to Use

**Still in development and testing. Unexpected errors and loss of funds may occur. Feedback is welcome!**

This module can easily extend your nodejs or express app.

[Docs](./docs)

### Install

```bash
$ npm install iota-payment
```

### Usage

Create a .env file with your settings

Always start with a new unused seed!

MAX_PAYMENT_TIME is the time until created paymentes aren't checked anymore in minutes

If you want to send payouts, without receiving iotas via payments first, send the iotas to the first address of the seed (index 0)

```bash
SEED='REPLACEWITHEIGHTYONETRYTESEED'
IOTANODE='https://nodes.thetangle.org:443'
MAX_PAYMENT_TIME=1440
```

Add `zmq` to check payment confirmations with zmq. Optional add `fast_but_risky` to have a payment success in seconds if a valid transaction was sent, don't use it with large amounts because a payment will be accepted before confirmation and an attacker could send the iotas to another address

```bash
zmq_node='tcp://tanglebeat.com:5556'
zmq=true
fast_but_risky=true
```

You can add `debug=basic` or `debug=full` to get more logs for debugging

```bash
var paymentModule = require('iota-payment')
var app = require('express')()

let server = paymentModule.createServer(app)

// Start server with iota-payment module on '/payments'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})
```

### Examples

- [01_simple_server](./examples/01_simple_server.js)
- [02_custom_server](./examples/02_custom_server.js)
- [03_events](./examples/03_events.js)
- [04_payment](./examples/04_payment.js)
- [05_payout](./examples/05_payout.js)
- [06_websockets](./examples/06_websockets.js)

## Contribute

This module is only possible because of a large community of contributors. A heartfelt thank you to everyone for all of your efforts!

You can help us too:

- [Create a new issue](https://github.com/machineeconomy/iota-payment/issues/new) to report bugs
- [Fix an issue](https://github.com/machineeconomy/iota-payment/issues)

Have a look at [CONTRIBUTING.md](https://github.com/machineeconomy/iota-payment/blob/master/CONTRIBUTING.md).

## License

[The MIT License](https://github.com/machineeconomy/iota-payment/blob/master/LICENSE.md)
