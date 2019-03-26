# koa2-router
An express-liked router component for koa2

  [![NPM Version][npm-image]][npm-url]

## Features

## Getting Started
You can follow the instructions below to setup a router component in koa@2 environment. 

### Prerequisties
* node version > 8.10
* depends on *koa*@2.0

### Installing
* If you use npm to manage your dependencies, run
```
npm install koa2-router
```

### Usage
* Import component
```javascript
const Router = require('koa2-router');
```

* Create a router
```javascript
const router = new Router(opts);
```

* Mount a router to a koa application
```javascript
const app = new Koa();
app.use(router);
```

* Mount a router to another router
```javascript
const router2 = new Router();
router2.use(...);
router.all('/users', router2);
```

* Use http method to handle request
```javascript
router2.get('/:userId', ctx => ctx.body = `hello user ${ctx.params.userId}`);
```

* Use params middleware like express
```javascript
const router3 = Router();
router3.params('userName', (ctx, next, userName, key) => (ctx[key] = userName, next()))
  .get('/:userName', async ctx => ctx.body = await ctx.db.getStaffFromName(ctx.userName));
router.all('/staff', router3);
```

* Use route to make a rest api
```javascript
const route = router3.route('/:id');
route
  .get(async ctx => ctx.body = await ctx.db.getStaffFromId(ctx.params.id));
```

* exit route or router without exception
```javascript
route
  .all(async (ctx, next) => {
     if (ctx.authenticate.userId === ctx.params.id) return next();
     else throw 'route'; // exit this route without any exception
  })   
  .put(async ctx => ctx.body = await ctx.db.updateStaff(ctx.params.id, ctx.request.body))
  .del(async ctx => ctx.body = await ctx.db.deleteStaff(ctx.params.id));
  
route3.all('/admin', (ctx, next) => {
    if (ctx.authenticate.userRoles.includes('admin')) return next();
    else throw 'router'; // exit this router3 without any exception
  })
  .post('/posts', async ctx => ctx.body = await ctx.db.createPost(ctx.request.body, ctx.authenticate.userId));
```

* implement Method Not Allowed and Not Implemented
```javascript
router.all('/api', router3, router3.allowMethods(opts))
```
`opts` the allowMethods options
`opts.throw` [boolean] default false, set to true to throw errors
`opts.methodNotAllowed` [function(ctx, methods)] set if throw a custom 405 error
`opts.notImplemented` [function(ctx)] set if throw a custom 501 error

## Nested Router Spec
In this module, router is a specific **function** instance which can be constructed via `router = new Router(opts)` or `router = Router(opts)`, and can be directly used as a `Koa.Middleware` function - `app.use(router)`.

We create a router model called **Express Liked Router Model**. The router constructed via this mechanism, implements everything that `express.Router` also dose, like `Router.use()`, `Router[method]()` `Router.params()` `Router.route()`.

But there is an issue about that mode, how nested router stack being built for an asynchronized middleware system.

Nested routers are supported, but in a different way. Considering the entering and exiting order of the stack, we have consulted and borrowed the middlewares in Golang: within that a new `Group` midleware is presented, and it can make a branching stack. So we borrowed this design and setup new rules in nested routers in order to constraint excuting orders:

1. Middleares using `.use` only insert pure `middlewares` to the original stack
> in `Router.use(path, middlewares)`,  `middlewares` are inserted into
> the parent's middlewares thus when the last one invokes `next`, it
> will continue `enter` the next one of the parent router, until all
> things done, then it will `leave` from the bottom to the top of the
> parent router's stack

Let's see an example
```js
var router = new Router('A')
var nested = new Router('B')
router.use(async (ctx, next) => {
  console.log('enter parent')
  await next()
  console.log('leave parent')
})
// use `.use so nested mw is bundled together with the parent`
router.use('/stuff', nested)
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

```

**GET /stuff** and watch the console
```bash
> enter parent
> enter nested
> prepare
> output body
> post
> leave nested
> leave parent

> HTTP/1.1 200 OK
> success
```

2. Middlewares using `[method]` `.all` or `.route` makes a branching stack of route nested in the parent stack
> in this situation, middlewares are bundled into another one, and
> if the one is matched both in method & route, calling `next` in the
> last middlewares of the nested router will `leave` the nested router > stack from bottom to the top first, and then if nothing is responded > before that, it enters the next middleware of the parent stack

Let's see another example, almost the same as above one
```js
var router = new Router('A')
var nested = new Router('B')
router.use(async (ctx, next) => {
  console.log('enter parent')
  await next()
  console.log('leave parent')
})
// use `.all` instead of `.use`
router.all('/stuff', nested)
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

```

**GET /stuff** and watch the console
```bash
> enter parent
> enter nested
> leave nested
> prepare
> output body
> post
> leave parent

> HTTP/1.1 200 OK
> success
```

The order of entering/leaving differs from the above example, because we make a branching stack nested in the router, and it will leave the branching stack before go over the next. It is just like the `Group` in the project [gobwas/glob](https://github.com/gobwas/glob) powered by golang

## Running tests
You should clone thie repository down to your file system, and execute
```
npm run test
```

## Acknowledgements
* Thanks to the [expressjs/express](https://github.com/expressjs/express) project
* Thanks to the [koa-router](https://github.com/alexmingoia/koa-router) project
* Thanks to the [router](https://github.com/pillarjs/router) project
* Thanks to the [gobwas/glob](https://github.com/gobwas/glob) project

## License
  [MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/koa2-router.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa2-router
