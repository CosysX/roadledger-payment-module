module.exports = {
  createPayment,
  getPayments,
  updatePayment,
  getOpenPayments,
  getPaymentByID
}

const db = require('./Database')
const { getNewAddress } = require('./Account')
const paymentHandler = require('./paymentHandler')
const eventHandler = require('./eventHandler')

function createPayment(value = 0, data) {
  return new Promise(function(resolve, reject) {
    //validate value
    if (!Number.isInteger(parseInt(value)) || parseInt(value) < 0) {
      throw 'Invalid value'
    }

    getNewAddress().then(res => {
      let payment = {
        address: res.address,
        index: res.index,
        value: value,
        data: JSON.stringify(data),
        payed: false
      }

      db.get('payments')
        .push(payment)
        .last()
        .assign({ id: Date.now().toString() })
        .write()
      let eventMessage = {
        type: 'payment',
        status: 'paymentCreated',
        payment
      }
      eventHandler.emit(eventMessage)
      paymentHandler.start()
      resolve(payment)
    })
  })
}

function getPayments() {
  return new Promise(function(resolve, reject) {
    resolve(db.get('payments').value())
  })
}

function updatePayment(payment) {
  return new Promise(function(resolve, reject) {
    let updated_payment = db
      .get('payments')
      .chain()
      .find({ _id: payment._id })
      .assign(payment)
      .value()
    resolve(updated_payment)
  })
}

function getOpenPayments() {
  return new Promise(function(resolve, reject) {
    resolve(
      db
        .get('payments')
        .filter({ payed: false })
        .value()
    )
  })
}

function getPaymentByID(id) {
  return new Promise(function(resolve, reject) {
    const payment = db
      .get('payments')
      .find({ id: id })
      .value()
    resolve(payment)
  })
}
