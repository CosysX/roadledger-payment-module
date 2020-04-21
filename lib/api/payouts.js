const { Router } = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const { sendPayout } = require('../payout.js')
const { getPayout, getPayouts } = require('../Database.js')

const app = Router()

app.post('/', function (req, res) {
  var body = req.query

  // TODO: Check body - valid payout object?
  console.log('send ', body)
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      sendPayout(body)
        .then((result) => {
          // send reponse with address.
          res.send({
            message: `Payout created.`,
            payout: result,
          })
        })
        .catch((err) => {
          res.send({
            message: err,
          })
        })
    }
  })
})

// return all payments
app.get('/', passport.authenticate('jwt'), function (req, res) {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayouts().then((payouts) => {
        res.send(payouts)
      })
    }
  })
})

// return payment by id
app.get('/:id', passport.authenticate('jwt'), function (req, res) {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayout({ id: req.params.id }).then((payment) => {
        if (typeof payment === 'undefined') {
          payment = 'id not found'
        }
        res.send(payment)
      })
    }
  })
})

module.exports = app
