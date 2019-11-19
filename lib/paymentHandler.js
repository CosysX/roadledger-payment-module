module.exports = { start }

const { getCurrentPayoutIndex } = require('./Account')
const iotaCore = require('@iota/core')
const Converter = require('@iota/converter')

const { getOpenPayments } = require('./payment')
const db = require('./Database')
const eventHandler = require('./eventHandler')

const iotaNode = process.env.IOTANODE
let maxPaymentTime = process.env.MAX_PAYMENT_TIME

const iota = iotaCore.composeAPI({
  provider: iotaNode
})
let paymentHandler = false
function start() {
  if (paymentHandler) {
    console.log('payment handler already started.')
    return
  }
  console.log('payment handler started')
  function checkPaymentStatus() {
    // check if there are open payments
    getOpenPayments().then(payments => {
      if (typeof payments !== 'undefined' && payments.length > 0) {
        // check if the transaction is confirmed
        checkPayments(payments)
      } else {
        console.log('there are no open payments')
        clearInterval(intervall)
        paymentHandler = false
      }
    })
  }
  const intervall = setInterval(checkPaymentStatus, 9000)
  paymentHandler = true
}

function checkPayments(payments) {
  const paymentsToCheckNoW = filterPaymentsToCheckNow(payments)

  // look for incoming value transactions
  checkForTransactions(paymentsToCheckNoW)

  const addresses = paymentsToCheckNoW.map(payment => payment.address)
  iota
    .getBalances(addresses, 100)
    .then(balances => {
      balances.balances.forEach((balance, index) => {
        if (balance >= paymentsToCheckNoW[index].value) {
          if (balance > paymentsToCheckNoW[index].value) {
            if (process.env.debug === 'true') {
              // console.log('thank you for the donation!')
              console.log(
                `Received ${balance -
                paymentsToCheckNoW[index].value}i more than required`
              )
            }
          }
          console.log(
            `Payment ${
            paymentsToCheckNoW[index].id
            } successfull! Address: ${paymentsToCheckNoW[index].address.slice(
              0,
              6
            )}`
          )
          const newPayment = db
            .get('payments')
            .find({ id: paymentsToCheckNoW[index].id })
            .assign({ payed: true })
            .write()

          // ignore already accepted payments
          if (typeof paymentsToCheckNoW[index].earlyAccepted === 'undefined') {
            const eventMessage = {
              type: 'payment',
              status: 'paymentSuccess',
              payment: newPayment
            }
            eventHandler.emit(eventMessage)
          }

          // check if index < payoutIndex, add to extra list so it can be used for inputs
          if (paymentsToCheckNoW[index].index < getCurrentPayoutIndex()) {
            db.get('indexesForPayouts')
              .push(paymentsToCheckNoW[index].index)
              .write()
          }
        } else {
          // exit early if payment is already accepted
          if (paymentsToCheckNoW[index].earlyAccepted === true) {
            return
          }
          if (balances >= 0) {
            // todo add emitter? or remove the if check?
            if (process.env.debug === 'true') {
              console.log(
                `Not enough iotas found for payment ${paymentsToCheckNoW[index].id}: ${balance} of ${paymentsToCheckNoW[index].value}`
              )
            }
          } else {
            const eventMessage = {
              type: 'payment',
              status: 'paymentPending',
              payment: paymentsToCheckNoW[index]
            }
            eventHandler.emit(eventMessage)
            if (process.env.debug === 'true') {
              console.log(
                `No iotas found for payment ${paymentsToCheckNoW[index].id}. Address: ${paymentsToCheckNoW[index].address}`
              )
            }
          }
        }
      })
    })
    .catch(err => console.error(err))

  // update lastTime
  paymentsToCheckNoW.forEach(payment => {
    // can maybe optimized with let database = db.get('payments') one line above and then use database.find() if that works
    db.get('payments')
      .find({ id: payment.id })
      .assign({ lastTime: Date.now() })
      .write()
  })
}

function checkForTransactions(payments) {
  // look for incoming value transactions
  const paymentsToCheck = payments.filter(e => e.earlyAccepted !== true)
  const paymentAdresses = paymentsToCheck.map(e => e.address)
  iota
    .findTransactionObjects({ addresses: paymentAdresses })
    .then(transactions => {
      transactions.forEach(tx => {
        if (tx.value > 0) {
          const payment = payments.find(
            payment => payment.address.slice(0, 81) === tx.address
          )
          // check if payment was already successfull
          const uptodatepayment = db
            .get('payments')
            .find({ id: payment.id })
            .value()
          if (uptodatepayment.payed === true) {
            return
          }
          if (process.env.debug === 'true') {
            console.log(
              `Incoming transaction for payment ${payment.id}: value tx: ${tx.value} value payment: ${payment.value}`
            )
          }
          if (tx.value >= payment.value) {
            const message = tx.signatureMessageFragment
            const txInfo = {
              message: Converter.trytesToAscii(message + '9').replace(
                /\0/g,
                ''
              ),
              timestamp: tx.timestamp,
              hash: tx.hash
            }
            db.get('payments')
              .find({ id: payment.id })
              .assign({ txInfo: txInfo })
              .write()
            const eventMessage = {
              type: 'payment',
              status: 'paymentIncoming',
              payment: payment
            }
            eventHandler.emit(eventMessage)
          }
        }
      })
    })
    .catch(err => {
      console.log(err)
    })
}

function filterPaymentsToCheckNow(payments) {
  const paymentsToCheckNoW = []

  if (typeof maxPaymentTime === 'undefined') {
    // use 9 days as default
    maxPaymentTime = 12960
  }

  // select payouts to check
  payments.forEach(payment => {
    // remove from payments to check if older than maxPaymentTime
    if ((Date.now() - payment.id) / 60000 > maxPaymentTime) {
      db.get('payments')
        .find({ id: payment.id })
        .assign({ payed: 'timeout' })
        .write()
    }

    if (typeof payment.lastTime === 'undefined') {
      paymentsToCheckNoW.push(payment)
      return
    }
    // add if younger than 9 minutes every time
    if ((Date.now() - payment.id) / 60000 < 9) {
      paymentsToCheckNoW.push(payment)
      return
    }
    // add if younger than 90 minutes && last check > 9 minutes
    if (
      (Date.now() - payment.id) / 60000 < 90 &&
      (Date.now() - payment.lastTime) / 60000 > 9
    ) {
      paymentsToCheckNoW.push(payment)
      return
    }
    // add if younger than maxPaymentTime (9 days default) && last check > 90 minutes
    if (
      (Date.now() - payment.id) / 60000 < maxPaymentTime &&
      (Date.now() - payment.lastTime) / 60000 > 90
    ) {
      paymentsToCheckNoW.push(payment)
    }
  })

  return paymentsToCheckNoW
}
