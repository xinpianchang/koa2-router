/*!
 * koa2-router
 * Copyright(c) 2018-2019 xinpianchang.com
 * Copyright(c) 2019 Tang Ye
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var Route = require('./route')
var Layer = require('./layer')
var methods = require('methods')
var mixin = require('utils-merge')
var compose = require('koa-compose')
var debug = require('debug')('koa2-router')
var deprecate = require('depd')('koa2-router')
var { flatten } = require('array-flatten')
var parseUrl = require('parseurl')
var setPrototypeOf = require('setprototypeof')
var delegates = require('delegates')
var HttpError = require('http-errors')

/**
 * Module variables.
 * @private
 */

var objectRegExp = /^\[object (\S+)\]$/
var slice = Array.prototype.slice
var toString = Object.prototype.toString
var featureSymbol = Symbol('koa2-router')

/**
 * Expose `Router`.
 */

module.exports = Router

/**
 * Expose `Route`.
 */

module.exports.Route = Route

/**
 * Add baseUrl/params/matched to the
 * prototype of request and context in app
 * 
 * We only need to patch once for a better
 * performance
 * 
 * @param {*} app 
 * @private
 */

function patchPrototype(app) {
  const context = app.context
  const request = app.request
  const response = app.response
  if (!request.hasOwnProperty(featureSymbol)) {
    Object.defineProperties(request, {
      baseUrl: {
        get: function() { return this.req.baseUrl },
        set: function(baseUrl) { return this.req.baseUrl = baseUrl }
      },
      params: {
        get: function() { return this.req.params },
        set: function(params) { return this.req.params = params }
      },
      matched: {
        get: function() { return this.req.matched },
        set: function(matched) { return this.req.matched = matched }
      },
      [featureSymbol]: {
        value: 'koa2-router',
        writable: false,
      }
    })
    Object.defineProperty(response, 'responded', {
      get: function() {
        return this.respond === false
          || this.headerSent
          || !this.writable
          || this._explicitStatus
          || this.status !== 404
      }
    })
    delegates(context, 'response')
      .access('responded')
    delegates(context, 'request')
      .access('baseUrl')
      .access('params')
      .access('matched')
      .getter(featureSymbol)
  }
}

/**
 * @alias module:koa2-router
 * Initialize a new `Router` with the given `options`.
 *
 * @param {Object} [options]
 * @return {Router} which is an callable function
 * @public
 */

function Router(options) {
  if (!(this instanceof Router)) {
    return new Router(options)
  }

  var opts = options || {}

  function router(ctx, next) {
    // patch context/request prototype
    patchPrototype(ctx.app)

    // initialize ctx.req with `originalUrl`, `baseUrl`, `params`
    const req = ctx.req
    req.originalUrl = req.originalUrl || req.url
    req.baseUrl = req.baseUrl || ''
    req.params = req.params || {}
    req.matched = req.matched || []

    return router.handle(ctx, next)
  }

  router._name = (typeof opts === 'object' ? opts.name : opts) || 'router'

  // inherit from the correct prototype
  setPrototypeOf(router, this)

  router.caseSensitive = opts.caseSensitive
  router.mergeParams = opts.mergeParams
  router.strict = opts.strict
  router.methods = opts.methods || [
    'HEAD',
    'OPTIONS',
    'GET',
    'PUT',
    'PATCH',
    'POST',
    'DELETE'
  ]
  router.params = {}
  router.stack = []

  if (!Array.isArray(router.methods)) {
    throw new TypeError('invalid options.methods, got type ' + gettype(opts.methods))
  }

  // we should never return 501 for GET/HEAD method
  // so we need to ensure router.methods contains at least GET and HEAD
  if (!~router.methods.indexOf('GET')) router.methods.push('GET')
  if (!~router.methods.indexOf('HEAD')) router.methods.push('HEAD')

  return router
}

/**
 * Router prototype inherits from a Function.
 */

/* istanbul ignore next */
Router.prototype = function () {}

/**
 * Map the given param placeholder `name`(s) to the given callback.
 *
 * Parameter mapping is used to provide pre-conditions to routes
 * which use normalized placeholders. For example a _:user_id_ parameter
 * could automatically load a user's information from the database without
 * any additional code,
 *
 * The callback uses the same signature as middleware, the only difference
 * being that the value of the placeholder is passed, in this case the _id_
 * of the user. Once the `next()` function is invoked, just like middleware
 * it will continue on to execute the route, or subsequent parameter functions.
 *
 * Just like in middleware, you must either respond to the request or call next
 * to avoid stalling the request.
 *
 *  router.param('user_id', async function(ctx, next, id) {
 *    const user = await User.find(id)
 *    if (!user) {
 *      throw new Error('failed to load user')
 *    }
 *    ctx.user = user
 *    await next()
 *  })
 *
 * @param {String} name
 * @param {Function} fn
 * @return {router} for chaining
 * @public
 */

Router.prototype.param = function param(name, fn) {
  // if name is an array, make each being invoked again
  if (Array.isArray(name) && name.length) {
    for (var i = 0; i < name.length; i++) {
      param.call(this, name[i], fn)
    }
    return this
  }

  if ('string' !== typeof name) {
    throw new TypeError('invalid param() call, got name type ' + gettype(name))
  }

  if (name[0] === ':') {
    deprecate('router.param(' + JSON.stringify(name) + ', fn): Use router.param(' + JSON.stringify(name.substr(1)) + ', fn) instead')
    // eslint-disable-next-line no-param-reassign
    name = name.substr(1)
  }

  if ('function' !== typeof fn) {
    throw new TypeError('invalid param() call for ' + name + ', got ' + gettype(fn))
  }

  (this.params[name] = this.params[name] || []).push(fn)

  return this
}

/**
 * Dispatch a koa context into the router.
 * @private
 */

Router.prototype.handle = async function handle(ctx, upstream) {
  if (typeof upstream !== 'function') {
    throw new TypeError('argument next(upstream) is required')
  }

  // save point
  var restoreCtx = restore(undefined, ctx, 'baseUrl', 'params', 'url')

  try {
    // dispatch into the current router
    await this.dispatch(ctx, upstream)
  } finally {
    // restore point
    restoreCtx()
  }
}

/**
 * use allowMethods to generate a middleware for
 * 
 * 
 * @public
 */

Router.prototype.allowMethods = function allowMethods(options) {
  options = options || {}
  var implemented = this.methods

  return async function(ctx, next) {
    await next()
    if (!ctx.responded) {
      const method = ctx.method
      const allowedArr = ctx.matched

      if (!~implemented.indexOf(method)) {
        // not implemented
        if (options.throw) {
          var notImplementedThrowable
          if (typeof options.notImplemented === 'function') {
            notImplementedThrowable = options.notImplemented(ctx)
          } else {
            notImplementedThrowable = new HttpError.NotImplemented()
          }
          throw notImplementedThrowable
        } else {
          ctx.status = 501
          sendOptionsResponse(ctx, allowedArr)
        }
      } else if (allowedArr.length) {
        // matched route in this router
        // but method not allowed
        if (method === 'OPTIONS') {
          ctx.status = 200
          sendOptionsResponse(ctx, allowedArr)
        } else if (!~allowedArr.indexOf(method)) {
          // method not allowed
          if (options.throw) {
            var notAllowedThrowable;
            if (typeof options.methodNotAllowed === 'function') {
              notAllowedThrowable = options.methodNotAllowed(ctx, allowedArr)
            } else {
              notAllowedThrowable = new HttpError.MethodNotAllowed()
            }
            throw notAllowedThrowable
          } else {
            ctx.status = 405
            sendOptionsResponse(ctx, allowedArr)
          }
        }
      }
    }
  }
}

/**
 * dispatch koa context into this router
 * @param matched collection for methods it has
 * @private
 */

Router.prototype.dispatch = function dispatch(ctx, done) {
  var self = this
  var matched = []

  // collect methods of which route matches
  // the path but not method
  done = wrap(done, function(fn) {
    if (matched.length) ctx.matched = matched
    return fn()
  })

  // restore properties in context
  done = restore(done, ctx, 'baseUrl', 'params', 'url')

  debug('dispatching %s %s%s', ctx.method, ctx.baseUrl, ctx.url)

  var idx = 0
  var protohost = getProtohost(ctx.url) || ''
  var removed = ''
  var slashAdded = false
  var paramcalled = {}

  // middleware and routes
  var stack = self.stack

  // manage inter-router variables
  var parentParams = ctx.params
  var parentUrl = ctx.baseUrl

  return next()

  function next() {
    // remove added slash
    if (slashAdded) {
      ctx.url = ctx.url.substr(1)
      slashAdded = false
    }

    // restore altered req.url
    if (removed.length !== 0) {
      ctx.baseUrl = parentUrl
      ctx.url = protohost + removed + ctx.url.substr(protohost.length)
      removed = ''
    }

    // no more matching layers
    if (idx >= stack.length) {
      return done()
    }

    // get pathname of request
    var path = getPathname(ctx)

    if (path == null) {
      // FIXME layer error for this router
      return next()
    }

    // find next matching layer
    var layer
    var match
    var route

    while (match !== true && idx < stack.length) {
      layer = stack[idx++]
      match = layer.match(path)
      route = layer.route

      if (match !== true) {
        continue
      }

      if (!route) {
        // process non-route handlers normally
        continue
      }

      var method = ctx.method
      var has_method = route._handles_method(method)

      // build up automatic options response
      if (!has_method) {
        matched.push.apply(matched, route._methods())
      }

      // don't even bother matching route
      if (!has_method && method !== 'HEAD') {
        match = false
        continue
      }
    }

    // no match
    if (match !== true) {
      return done()
    }

    // store route for dispatch on change
    if (route) {
      ctx.route = route
    }

    // Capture one-time layer values
    ctx.params = self.mergeParams
      ? mergeParams(layer.params, parentParams)
      : layer.params
    var layerPath = layer.path

    // this should be done for the layer
    return self.process_params(layer, paramcalled, ctx, function() {
      if (route) {
        return layer.handle(ctx, next)
      }
      // .use middlewares
      return trim_prefix(layer, layerPath, path, next)
    }).catch(function(e) {
      if (e === 'router') {
        return done()
      }
      throw e
    })
  }

  function trim_prefix(layer, layerPath, path, next) {
    if (layerPath.length !== 0) {
      // Validate path breaks on a path separator
      var c = path[layerPath.length]
      if (c && c !== '/' && c !== '.') return next()

      // Trim off the part of the url that matches the route
      // middleware (.use stuff) needs to have the path stripped
      debug('trim prefix (%s) from url %s', layerPath, ctx.url);
      removed = layerPath
      ctx.url = protohost + ctx.url.substr(protohost.length + removed.length)

      // Ensure leading slash
      if (!protohost && ctx.url[0] !== '/') {
        ctx.url = '/' + ctx.url
        slashAdded = true
      }

      // Setup base URL (no trailing slash)
      ctx.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
        ? removed.substring(0, removed.length - 1)
        : removed)
    }

    debug('%s %s: %s', layer.name, layerPath, ctx.originalUrl)

    return layer.handle(ctx, next)
  }
}

/**
 * Process any parameters for the layer.
 * @private
 */

Router.prototype.process_params = function process_params(layer, called, ctx, done) {
  var params = this.params

  // captured parameters from the layer, keys and values
  var keys = layer.keys

  // fast track
  if (!keys || keys.length === 0) {
    return done()
  }

  var i = 0
  var name
  var paramIndex = 0
  var key
  var paramVal
  var paramCallbacks
  var paramCalled

  return param()

  // process params in order
  // param callbacks can be async
  function param() {
    if (i >= keys.length) {
      return done()
    }

    paramIndex = 0
    key = keys[i++]
    name = key.name
    paramVal = ctx.params[name]
    paramCallbacks = params[name]
    paramCalled = called[name]

    if (paramVal === undefined || !paramCallbacks) {
      return param()
    }

    // param previously called with same value
    if (paramCalled && paramCalled.match === paramVal) {
      // restore value
      ctx.params[name] = paramCalled.value

      // process next param, don't re-process
      // unless not match with the last called
      return param()
    }

    called[name] = paramCalled = {
      match: paramVal,
      value: paramVal
    }

    return paramCallback()
  }

  // single param callbacks
  async function paramCallback() {
    var fn = paramCallbacks[paramIndex++]

    // acquire the reference of the outer variable for
    // later use, otherwise we may alter it by mistake
    var pcalled = paramCalled
    var k = key

    // store updated value
    pcalled.value = ctx.params[k.name]

    if (typeof fn !== 'function') {
      await param()
      return
    }

    try {
      await fn(ctx, paramCallback, paramVal, k.name)
    } finally {
      // store updated value
      pcalled.value = ctx.params[k.name]
    }
  }
}

/**
 * Use the given middleware function, with optional path, defaulting to "/".
 *
 * Use (like `.all`) will run for any http METHOD, but it will not add
 * handlers for those methods so OPTIONS requests will not consider `.use`
 * functions even if they could respond.
 *
 * The other difference is that _route_ path is stripped and not visible
 * to the handler function. The main effect of this feature is that mounted
 * handlers can operate without any code changes regardless of the "prefix"
 * pathname.
 *
 * @public
 */

Router.prototype.use = function use(handler) {
  var offset = 0
  var path = '/'

  // default path to '/'
  // disambiguate router.use([handler])
  if (typeof handler !== 'function') {
    var arg = handler

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0]
    }

    // first arg is the path
    if (typeof arg !== 'function') {
      offset = 1
      path = handler
    }
  }

  var callbacks = flatten(slice.call(arguments, offset))

  if (callbacks.length === 0) {
    throw new TypeError('Router.use() requires a middleware function')
  }

  if (callbacks.length > 1 && path !== '/' && path !== '*') {
    // compose callbacks as one middleware
    callbacks = [ compose(callbacks) ];
  }

  for (var i = 0; i < callbacks.length; i++) {
    var fn = callbacks[i]

    if (typeof fn !== 'function') {
      throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn))
    }

    // add the middleware
    debug('use %o %s', path, fn._name || fn.name || '<anonymous>')

    var layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: false,
      end: false
    }, fn)

    layer.route = undefined

    this.stack.push(layer)
  }

  return this
}

/**
 * Create a new Route for the given path.
 *
 * Each route contains a separate middleware stack and VERB handlers.
 *
 * See the Route api documentation for details on adding handlers
 * and middleware to routes.
 *
 * @param {String} path
 * @return {Route}
 * @public
 */

Router.prototype.route = function route(path) {
  var route = new Route(path)

  var layer = new Layer(path, {
    sensitive: this.caseSensitive,
    strict: this.strict,
    end: true
  }, route.handle.bind(route))

  layer.route = route

  this.stack.push(layer)
  return route
}

// create Router#VERB functions
methods.concat('all').forEach(function(method) {
  Router.prototype[method] = function(path) {
    var offset = 1
    if (typeof path === 'function') {
      path = '/'
      offset = 0
    }
    var route = this.route(path)
    route[method].apply(route, slice.call(arguments, offset))
    return this
  }
})

/**
 * use the alias `del` method for `delete`
 */
Router.prototype.del = Router.prototype.delete

// get pathname of request context
function getPathname(ctx) {
  return parseUrl(ctx).pathname
}

// Get get protocol + host for a URL
function getProtohost(url) {
  if (typeof url !== 'string' || url.length === 0 || url[0] === '/') {
    return undefined
  }

  var searchIndex = url.indexOf('?')
  var pathLength = searchIndex !== -1
    ? searchIndex
    : url.length
  var fqdnIndex = url.substr(0, pathLength).indexOf('://')

  return fqdnIndex !== -1
    ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
    : undefined
}

// get type for error message
function gettype(obj) {
  var type = typeof obj

  if (type !== 'object') {
    return type
  }

  // inspect [[Class]] for objects
  return toString.call(obj).replace(objectRegExp, '$1')
}

// merge params with parent params
function mergeParams(params, parent) {
  if (typeof parent !== 'object' || !parent) {
    return params
  }

  // make copy of parent for base
  var obj = mixin({}, parent)

  // simple non-numeric merging
  if (!(0 in params) || !(0 in parent)) {
    return mixin(obj, params)
  }

  var i = 0
  var o = 0

  // determine numeric gaps
  while (i in params) {
    i++
  }

  while (o in parent) {
    o++
  }

  // offset numeric indices in params before merge
  for (i--; i >= 0; i--) {
    params[i + o] = params[i]

    // create holes for the merge when necessary
    if (i < o) {
      delete params[i]
    }
  }

  return mixin(obj, params)
}

// save obj props for restoring after a while
function restore(fn, obj) {
  var props = new Array(arguments.length - 1)
  var vals = new Array(arguments.length - 1)

  for (var i = 0; i < props.length; i++) {
    props[i] = arguments[i + 1]
    vals[i] = obj[props[i]]
  }

  return function() {
    // restore vals
    for (var i = 0; i < props.length; i++) {
      obj[props[i]] = vals[i]
    }

    return fn && fn.apply(this, arguments)
  }
}

/**
 * Send an OPTIONS response.
 *
 * @private
 */

function sendOptionsResponse(ctx, matched) {
  if (ctx.respond !== false) {
    var options = Object.create(null)

    // build unique method map
    for (var i = 0; i < matched.length; i++) {
      options[matched[i]] = true
    }

    // construct the allow list
    var body = Object.keys(options).sort().join(', ')

    if (body) ctx.set('Allow', body)
    ctx.set('X-Content-Type-Options', 'nosniff')
  }
}

/**
 * Wrap a function
 *
 * @private
 */

function wrap(old, fn) {
  return function proxy() {
    var args = new Array(arguments.length + 1)

    args[0] = old
    for (var i = 0, len = arguments.length; i < len; i++) {
      args[i + 1] = arguments[i]
    }

    return fn.apply(this, args)
  }
}
