# koa2-router
An express-liked router component for koa2

  [![NPM Version][npm-image]][npm-url]

## Features
* Express-style routing using .use|.params|.all|.route|[method]
* Arrayed path prefix
* Multiple, nestable router stacks
* 405 Method Not Allowed support
* 501 Not Implemented support
* Named router for debug
* Bounded baseUrl|url|params|matched|responded upon app.context|request|response

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
router.use('/users', router2);
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
router.use('/staff', router3);
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
  
route3.use('/admin', (ctx, next) => {
    if (ctx.authenticate.userRoles.includes('admin')) return next();
    else throw 'router'; // exit this router3 without any exception
  })
  .post('/posts', async ctx => ctx.body = await ctx.db.createPost(ctx.request.body, ctx.authenticate.userId));
```

* implement Method Not Allowed and Not Implemented
```javascript
router.use('/api', router3, router3.allowMethods(opts))
```

`opts` the allowMethods options

`opts.throw` [boolean] default false, set to true to throw errors

`opts.methodNotAllowed` [function(ctx, methods)] set if throw a custom 405 error

`opts.notImplemented` [function(ctx)] set if throw a custom 501 error

## Nested Router Stacks
In this module, router is a specific **function** instance which can be constructed via `router = new Router(opts)` or `router = Router(opts)`, and can be directly used as a `Koa.Middleware` function - `app.use(router)`.

We create a router model called **Express Liked Router Model**. The router constructed via this mechanism, implements everything that `express.Router` also dose, like `Router.use()`, `Router[method|all]()` `Router.params()` `Router.route()`.

But there is an issue about that mode, how nested router stacks proceed for an asynchronized middleware system.

Nested routers are supported, but not behaves like in a single stack: enter -> enter -> enter <-> leave <- leave <- leave. Considering the entering and leaving order of the stack is relevant to the way they are mounted, we consulted and borrowed the algo from a Golang open source project [gobwas/glob][4]: within that a new `Group` midleware is introduced, and it can make a branching stack. So we borrowed this design and setup new rules in nested routers in order to constraint excuting stack orders:

1. Middlewares using `.use()` in which path can just be `/` or `*`, insert `middlewares` to the original stack
> in `Router.use(middlewares)`,  `middlewares` are inserted into
> the parent's middlewares, thus when the last one invokes `next()`, it
> will continue `enter` the next one of the parent router, until all
> things done, then it will `leave` from the bottom to the top of the
> parent router's stack

2. Middlewares using `[method]` `.all` `.route` or `.use(path)` makes a branching stack of route nested in the parent stack
> in this situation, middlewares are handled via a mounted path or route
> if the one is matched both in path & route, calling `next` in the
> last middlewares of the nested router will `leave` the mounted router
> stack from bottom to the top first, and then if nothing is responded
> before that, it enters the next middleware of the parent stack

Let's see an example
```javascript
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
> leave nested
> prepare
> output body
> post
> leave parent

> HTTP/1.1 200 OK
> success
```

The order of entering/leaving differs between router and nested router. Because we make a branching stack nested in the router by mounting it to a path `/stuff`, and it will leave the branching stack before go over the next. It is just like the `Group` in the project [gobwas/glob](4) powered by golang

## Running tests
You should clone thie repository down to your file system, and execute
```
npm run test
```

## API Documents
### Context
* ctx.baseUrl: string
* ctx.url: string
* ctx.params: any
* ctx.matched: string[]
* ctx.responded: boolean

### Router
* class Router(name: string | opts: any):Middleware
* router.use([path: string | string[]], ...middlewares: Middleware):Router
* router.route(path: string | string[]):Route
* router.all([path: string | string[]], ...middlewares: Middleware):Router
* router[method]([path: string | string[]], ...middlewares: Middleware):Router
* router.params(name: string, callback: (ctx, next, value: string, name: string) => void):Router

### Route
* route.all([path: string | string[]], ...middlewares: Middleware):Router
* route[method]([path: string | string[]], ...middlewares: Middleware):Router

## Acknowledgements
* Thanks to the [expressjs/express][1] project
* Thanks to the [alexmingoia/koa-router][2] project
* Thanks to the [pillarjs/router][3] project
* Thanks to the [gobwas/glob](4) project

## License
  [MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/koa2-router.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa2-router
[1]: https://github.com/expressjs/express
[2]: https://github.com/alexmingoia/koa-router
[3]: https://github.com/pillarjs/router
[4]: https://github.com/gobwas/glob
