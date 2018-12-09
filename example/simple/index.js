/**
 * Module dependencies.
 */
var Koa = require('koa');
var delay = require('delay');
var createError = require('http-errors');
var Router = require('../../lib');

var app = new Koa();

// Example requests:
//     curl http://localhost:3000/user/0
//     curl http://localhost:3000/user/0/edit
//     curl http://localhost:3000/user/1
//     curl http://localhost:3000/user/1/edit (unauthorized since this is not you)
//     curl -X DELETE http://localhost:3000/user/0 (unauthorized since you are not an admin)

// Dummy users
var users = [
    { id: 0, name: 'tj', email: 'tj@vision-media.ca', role: 'member' }
  , { id: 1, name: 'ciaran', email: 'ciaranj@gmail.com', role: 'member' }
  , { id: 2, name: 'aaron', email: 'aaron.heckmann+github@gmail.com', role: 'admin' }
];

async function loadUser(ctx, next) {
  // You would fetch your user from the db
  await delay(100);
  var user = users[ctx.params.id];
  if (user) {
    ctx.user = user;
    await next();
  } else {
    throw createError(404, 'Failed to load user ' + ctx.params.id);
  }
}

async function andRestrictToSelf(ctx, next) {
  // If our authenticated user is the user we are viewing
  // then everything is fine :)
  if (ctx.authenticatedUser.id === ctx.user.id) {
    await next();
  } else {
    // You may want to implement specific exceptions
    // such as UnauthorizedError or similar so that you
    // can handle these can be special-cased in an error handler
    // (view ./examples/pages for this)
    throw createError(401, 'Unauthorized');
  }
}

function andRestrictTo(role) {
  return async function(ctx, next) {
    if (ctx.authenticatedUser.role === role) {
      await next();
    } else {
      throw createError(401, 'Unauthorized');
    }
  }
}

// Middleware for faux authentication
// you would of course implement something real,
// but this illustrates how an authenticated user
// may interact with middleware
var router = Router();

router.use(function(ctx, next) {
  ctx.authenticatedUser = users[2];
  return next();
});

router.get('/', function(ctx) {
  ctx.redirect('/user/0');
});

router.get('/user/:id', loadUser, function(ctx) {
  ctx.body = 'Viewing user ' + ctx.user.name;
});

router.get('/user/:id/edit', loadUser, andRestrictToSelf, function(ctx) {
  ctx.body = 'Editing user ' + ctx.user.name;
});

router.delete('/user/:id', loadUser, andRestrictTo('admin'), function(ctx) {
  ctx.body = 'Deleted user ' + ctx.user.name;
});

app.use(router);

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Koa started on port 3000');
}
