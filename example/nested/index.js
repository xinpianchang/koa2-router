var Koa = require('koa')
var createError = require('http-errors')
var morgan = require('koa-morgan')
var Router = require('../../lib')

var app = new Koa()

var router = new Router('A')
var nested = new Router('B')
router.use(async (ctx, next) => {
  console.log('enter parent')
  await next()
  console.log('leave parent')
})
// router.use('/stuff', nested)
router.all('/stuff', nested) // different usage between `.all and .use`
router.use(async (ctx, next) => {
  console.log('prepare')
  await next()
  console.log('post')
})
router.use(ctx => {
  console.log('output body')
  ctx.body = 'success'
})

nested.use(async (ctx, next) => {
  console.log('enter nested')
  await next()
  console.log('leave nested')
})

app.use(morgan('dev'))
app.use(router)

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000)
  console.log('Koa started on port 3000')
}