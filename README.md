# koa2-router
A express-liked router component for koa2

## Getting Started
You can follow the instructions below to setup a router componnent in koa@2 environment. 

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

* use http method handle request
```
router2.get('/:userId', ctx => ctx.body = `hello user ${ctx.params.userId}`);
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
