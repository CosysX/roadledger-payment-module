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
const { add_address_to_zmq } = require('./zmq.js')

/**
 * Creates and returns a payment.
 * @param {object} paymentInput - data for the payment
 * @param {number} [paymentInput.value] - iota value
 * @param {number} [paymentInput.timeUntilConfirmation] - time in seconds until the payment is confirmed, independent of the received amount
 * @param {any} [paymentInput.data] - additional data
 * @returns {object} payment
 * @example
 * // create a payment with the value option
 * paymentModule.payment.createPayment({value: 1, data: { "test": "123" }})
 *  .then(payment => {
 *    console.log(payment)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payment:
 * { data: '',
 * payed: false,
 * txInfo: null,
 * type: 'value',
 * value: 1,
 * address:
 *  'IDEAVKKGLZUCAZJEWOUXVCUYGPSINKJR9UVBEOXRNIOBJFAKUN9GVBDGVEVOOK9HVMMMFMDLZ9G9YFHPWULQWCXYVW',
 * index: 49,
 * id: '1575750004195'}
 * // create a payment with the timeUntilConfirmation option
 * paymentModule.payment.createPayment({timeUntilConfirmation: 180, data: { "test": "123" }})
 *  .then(payment => {
 *    console.log(payment)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payment:
 * { data: { test: '123' },
 * payed: false,
 * txInfo: null,
 * type: 'time',
 * confirmationTime: 1575750870,
 * address:
 *  'BQGQONEUNQYDDEUFDZIJDTVTFUBSIQECBLPU9BNNDVPMXMKFCWYODBGSPHA9TYCFFSYGUH9OIZYDIGBMCXHRBEIIAX',
 * index: 50,
 * id: '1575750690816' }
 */
function createPayment(paymentInput) {
  return new Promise(async (resolve, reject) => {
    try {
      let { value, timeUntilConfirmation, data = '' } = paymentInput
      let payment = { data, payed: false, txInfo: null }
      if (
        typeof value != 'undefined' &&
        typeof timeUntilConfirmation != 'undefined'
      ) {
        throw 'Invalid paymentInput, use either value or timeUntilConfirmation'
      }
      if (typeof timeUntilConfirmation == 'undefined') {
        //validate value
        if (!Number.isInteger(parseInt(value)) || parseInt(value) < 0) {
          throw 'Invalid paymentInput value'
        }
        payment.type = 'value'
        payment.value = parseInt(value)
      } else {
        //validate timeUntilConfirmation
        if (
          !Number.isInteger(parseInt(timeUntilConfirmation)) ||
          parseInt(timeUntilConfirmation) < 0
        ) {
          throw 'Invalid paymentInput time'
        }
        payment.type = 'time'
        payment.confirmationTime =
          Math.round(new Date() / 1000) + parseInt(timeUntilConfirmation)
      }

      let addressInfo = await getNewAddress()
      Object.assign(payment, {
        address: addressInfo.address,
        index: addressInfo.index
      })

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
      //add address to zmq monitoring
      if (process.env.fast_but_risky == 'true' || process.env.zmq == 'true') {
        if (payment.type == 'value') {
          add_address_to_zmq(payment.address)
        }
      }
      resolve(payment)
    } catch (e) {
      console.error(e)
    }
  })
}

/**
 * Returns all payments
 * @returns {Object[]} payments
 * @example
 * // get payments
 * paymentModule.payment.getPayments()
 *  .then(payments => {
 *    console.log(payments)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payments:
 * [ { address:
 *   'CLHNILYEPUQYJWRSGPQGA9BVVKHFHQMDM9ENNSGAHJXJIOLMBARZNHKWZZVGXSSQITOHPD9JXQGVQJJJBKMVRFWSNW',
 *  index: 10,
 *  value: '0',
 *  data: 'test',
 *  payed: true,
 *  id: '1570466750915',
 *  lastTime: 1570466754629 },
 * { address:
 *   'CLTDMWYNTKMPSISD9CBLH9MGATUZQXDALPZQBMHPJQLTKDTWDKFRJQYDKUCPYQFTFPNJBEIHHJRBKQMXXHNSUYEXJC',
 *  index: 12,
 *  value: 1,
 *  payed: false,
 *  id: '1570564499942' } ]
 */
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
      .find({ id: payment.id })
      .assign(payment)
      .value()
    resolve(updated_payment)
  })
}

/**
 * Returns all open (not payed and not too old) payments
 * @returns {Object[]} open payments
 * @example
 * // get open payments
 * paymentModule.payment.getPayments()
 *  .then(payments => {
 *    console.log(payments)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payments:
 * [ { address:
 *   'QXHAEPJSEIUAMMOUWDGYJD9MPPIGBYOPAQSPOZK9VZSGDVVV9SUJEYVXYRFL9KRRBWSDNIFGBDLH9DBADGABSCFTFD',
 *  index: 11,
 *  value: 1,
 *  data: { test: '123' },
 *  payed: false,
 *  id: '1570554460662' },
 * { address:
 *   'CLTDMWYNTKMPSISD9CBLH9MGATUZQXDALPZQBMHPJQLTKDTWDKFRJQYDKUCPYQFTFPNJBEIHHJRBKQMXXHNSUYEXJC',
 *  index: 12,
 *  value: 1,
 *  payed: false,
 *  id: '1570564499942' } ]
 */
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

/**
 * Returns payment by id
 * @returns {Object} payment
 * @example
 * // get payment by id
 * paymentModule.payment.getPaymentByID('1570564499942')
 *  .then(payment => {
 *    console.log(payment)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payment:
 * { address:
 *   'CLTDMWYNTKMPSISD9CBLH9MGATUZQXDALPZQBMHPJQLTKDTWDKFRJQYDKUCPYQFTFPNJBEIHHJRBKQMXXHNSUYEXJC',
 *  index: 12,
 *  value: 1,
 *  payed: false,
 *  id: '1570564499942' }
 */
function getPaymentByID(id) {
  return new Promise(function(resolve, reject) {
    const payment = db
      .get('payments')
      .find({ id: id })
      .value()
    resolve(payment)
  })
}
