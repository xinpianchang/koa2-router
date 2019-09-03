import Koa from 'koa'
import Router from '../../'

const app = new Koa()

const router = new Router()

router.route('/').get().head((_, next) => next())

router.param('id', (ctx, next, value, name) => { ctx.params; })

router.use('/abc', router.allowMethods())

router.get('/:id', ctx => ctx.body = ctx.id)

app.use(router)
