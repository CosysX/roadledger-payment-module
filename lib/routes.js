module.exports = createRoutes

const { createPayment, getPayments, getPaymentByID } = require('./payments.js')

function createRoutes(app, mount = 'payments', value = 0) {
  app.get(mount, function(request, response) {
    getPayments().then(payments => {
      response.send(payments)
    })
  })

  app.post(mount, function(request, response) {
    var body = request.body

    createPayment(value, body).then(payment => {
      // send reponse with address.
      response.send({
        message: `Payment created. Please pay ${value} iota to provided address.`,
        payment: payment
      })
    })
  })

  app.get(mount + '/:id', function(request, response) {
    getPaymentByID(request.params.id).then(payment => {
      response.send(payment)
    })
  })
}
