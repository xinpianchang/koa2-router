# koa2-router
An express-liked router component for koa2

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
```
const Router = require('koa2-router');
```

* Create a router
```
const router = Router(opts);
```

* Mount a router to a koa application
```
const app = new Koa();
app.use(router);
```

* Mount a router to another router
```
const router2 = Router();
router2.use(...);
router.use('/users', router2);
```

* Use http method to handle request
```
router2.get('/:userId', ctx => ctx.body = `hello user ${ctx.params.userId}`);
```

* Use params middleware like express
```
const router3 = Router();
router3.params('userName', (ctx, next, userName, key) => (ctx[key] = userName, next()))
  .get('/:userName', async ctx => ctx.body = await ctx.db.getStaffFromName(ctx.userName));
router.use('/staff', router3);
```

* Use route to make a rest api
```
const route = router3.route('/:id');
route
  .get(async ctx => ctx.body = await ctx.db.getStaffFromId(ctx.params.id));
```

* exit route or router without exception
```
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

## Running tests
You should clone thie repository down to your file system, and execute
```
npm run test
```

## License
This project is licensed under the MIT License

## Acknowledgements
* Thanks to the [expressjs/express](https://github.com/expressjs/express) project
* Thanks to the [koa-router](https://github.com/alexmingoia/koa-router) project
