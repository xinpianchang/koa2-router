/**
 * Module dependencies.
 */

var Koa = require('koa');
var createError = require('http-errors');
var morgan = require('koa-morgan');
var Router = require('../../lib');

var app = new Koa();
var router = module.exports = Router();

app.use(morgan('dev'));
app.use(router);

// Faux database

var users = [
    { name: 'tj' }
  , { name: 'tobi' }
  , { name: 'loki' }
  , { name: 'jane' }
  , { name: 'bandit' }
];

// Convert :to and :from to integers

router.param(['to', 'from'], function(ctx, next, num, name) {
  ctx.params[name] = parseInt(num, 10);
  if( isNaN(ctx.params[name]) ){
    throw createError(400, 'failed to parseInt '+num);
  } else {
    return next();
  }
});

// Load user by id

router.param('user', function(ctx, next, id){
  if (ctx.user = users[id]) {
    return next();
  }
});

/**
 * GET index.
 */

router.get('/', function(ctx) {
  ctx.body = 'Visit /user/0 or /users/0-2';
});

/**
 * GET :user.
 */

router.get('/user/:user', function(ctx) {
  ctx.body = 'user ' + ctx.user.name;
});

/**
 * GET users :from - :to.
 */

router.get('/users/:from-:to', function(ctx) {
  var from = ctx.params.from;
  var to = ctx.params.to;
  var names = users.map(function(user){ return user.name; });
  ctx.body = 'users ' + names.slice(from, to + 1).join(', ');
});

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Koa started on port 3000');
}