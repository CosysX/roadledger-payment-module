module.exports = { createServer, on }

const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const http = require('http')
const bodyParser = require('body-parser')
const cors = require('cors')
const passport = require('passport')
const { ExtractJwt, Strategy } = require('passport-jwt')

const eventEmitter = require('./eventEmitter')
const paymentHandler = require('./paymentHandler')
const payoutHandler = require('./payoutHandler')
const WebSockets = require('./WebSockets.js')
const { startZmq } = require('./zmq.js')
const api = require('./api')

// Start Handler
paymentHandler.start()
payoutHandler.start()

/**
 * Creates and returns a express server.
 * @param {object} app - an express application.
 * @param {object} options - an options object.
 * @param {Boolean} options.websockets - websockets.
 * @param {Boolean} options.dashboard - dashboard at /iotapay.
 * @param {Boolean} options.api - api at /iotapay/api.
 * @returns {object} an http server
 * @example
 * // creates a simple server
 * var paymentModule = require('iota-payment')
 * var app = require('express')()
 *
 * let server = paymentModule.createServer(app, {api: true})
 *
 * // Start server with iota-payment api on '/iotapay/api'
 * server.listen(3000, function () {
 *    console.log(`Server started on http://localhost:3000 `)
 * })
 */
function createServer(app, options = {}) {
  options = options || {}
  app = app || express()

  app.use(bodyParser.json()) // to support JSON-encoded bodies
  app.use(
    bodyParser.urlencoded({
      // to support URL-encoded bodies
      extended: true
    })
  )
  app.use(cors())

  app.use(passport.initialize({ session: false }))

  const jwtOptions = {
    secretOrKey: 'test_secret',
    jwtFromRequest: ExtractJwt.fromHeader('authorization')
  }

  passport.use(
    'jwt',
    new Strategy(jwtOptions, (jwtPayload, done) => {
      const user = jwtPayload
      if (user) return done(null, user)
      else return done(null, false)
    })
  )

  passport.serializeUser(function(user, done) {
    done(null, user)
  })

  if (options.api) {
    app.use('/iotapay/api', api({}))
    console.log('API on /iotapay/api')
  }

  if (options.dashboard) {
    app.use('/iotapay', express.static('dashboard/dist'))
    console.log('Dasboard on /iotapay')
  }

  let server = http.createServer(app)

  let websockets = options.websockets || false
  if (websockets) {
    WebSockets.start(server)
  }

  if (process.env.fast_but_risky == 'true' || process.env.zmq == 'true') {
    if (typeof process.env.zmq_node == 'undefined') {
      throw 'Undefined zmq node, pls add one in the .env file or disable zmq/fast_but_risky'
    } else {
      startZmq()
      console.log('zmq started')
    }
  }

  if (process.env.debug == 'basic' || process.env.debug == 'full') {
    console.log('debug true')
  }

  return server
}

/**
 * This method attaches an event listener.
 * @param {object} event - event name
 * @param {function} fnc - the function which will be called
 * @example
 * var paymentModule = require('iota-payment')
 *
 * //Create an event handler which is called, when a payment was successfull
 * var onPaymentSuccess = function (payment) {
 *     console.log('payment success!', payment);
 * }
 *
 * //Assign the event handler to an event:
 * paymentModule.on('paymentSuccess', onPaymentSuccess);
 */
function on(event, fnc) {
  eventEmitter.addListener(event, fnc)
}
