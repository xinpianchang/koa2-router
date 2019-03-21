/**
 * Module dependencies.
 */

var Koa = require('koa')
var createError = require('http-errors')
var morgan = require('koa-morgan')
var Router = require('../../lib')
var techRouter = require('../param')
var saleRouter = require('../simple')

var app = new Koa()
var router = module.exports = Router()

app.use(morgan('dev'))
app.use(router)

router.use('/tech', techRouter)
router.use('/sale', saleRouter)

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000)
  console.log('Koa started on port 3000')
}