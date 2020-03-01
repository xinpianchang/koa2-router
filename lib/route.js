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

var debug = require('debug')('koa2-router:route')
var flatten = require('array-flatten').flatten
var methods = require('methods')
var Layer = require('./layer')

/**
 * Module variables.
 * @private
 */

var slice = Array.prototype.slice
var toString = Object.prototype.toString

/**
 * Module exports.
 * @public
 */

module.exports = Route

/**
 * Initialize `Route` with the given `path`,
 *
 * @param {String} path
 * @public
 */

function Route(path) {
  if (!(this instanceof Route)) {
    return new Route(path)
  }

  this.path = path
  this.stack = []

  debug('new route %o', path)

  // route handlers for various http methods
  this.methods = {}
}

/**
 * Determine if the route handles a given method.
 * @private
 */

Route.prototype._handles_method = function _handles_method(method) {
  if (this.methods._all) {
    return true
  }

  var name = method.toLowerCase()

  if (name === 'head' && !this.methods['head']) {
    name = 'get'
  }

  return Boolean(this.methods[name])
}

/**
 * @return {Array} supported HTTP methods
 * @private
 */

Route.prototype._methods = function _methods() {
  var methods = Object.keys(this.methods)

  // append automatic head
  if (this.methods.get && !this.methods.head) {
    methods.push('head')
  }

  for (var i = 0; i < methods.length; i++) {
    // make upper case
    methods[i] = methods[i].toUpperCase()
  }

  return methods
}

/**
 * handle route middleware
 * @private
 */

Route.prototype.handle = async function handle(ctx, upstream) {
  if (typeof upstream !== 'function') {
    throw new TypeError('argument next(upstream) is required')
  }

  await this.dispatch(ctx, upstream)
}

/**
 * dispatch koa context into this route
 * @private
 */

Route.prototype.dispatch = function dispatch(ctx, done) {
  var idx = 0
  var stack = this.stack

  if (stack.length === 0) {
    return done()
  }

  var method = ctx.method.toLowerCase()
  if (method === 'head' && !this.methods['head']) {
    method = 'get'
  }

  ctx.route = this

  return next()

  function next() {
    var layer
    var match

    // find next matching layer
    while (match !== true && idx < stack.length) {
      layer = stack[idx++]
      match = !layer.method || layer.method === method
    }

    // no match
    if (match !== true) {
      return done()
    }

    return layer.handle(ctx, next).catch(function(e) {
      if (e === 'route') {
        return done()
      }
      throw e
    })
  }
}

/**
 * Add a handler for all HTTP verbs to this route.
 *
 * Behaves just like middleware and can respond or call `next`
 * to continue processing.
 *
 * You can use multiple `.all` call to add multiple handlers.
 *
 *   function check_something(ctx, next) {
 *     next()
 *   }
 *
 *   function validate_user(ctx, next) {
 *     next()
 *   }
 *
 *   route
 *   .all(validate_user)
 *   .all(check_something)
 *   .get(function(ctx, next) {
 *     ctx.body = 'hello world'
 *   })
 *
 * @param {function} handler
 * @return {Route} for chaining
 * @api public
 */

Route.prototype.all = function all() {
  var handlers = flatten(slice.call(arguments))

  if (handlers.length === 0) {
    throw new TypeError('argument handler is required')
  }

  for (var i = 0; i < handlers.length; i++) {
    var handler = handlers[i]

    if (typeof handler !== 'function') {
      var type = toString.call(handler)
      var msg = 'Route.all() requires a callback function but got a ' + type
      throw new TypeError(msg)
    }

    var layer = new Layer('/', {}, handler)
    layer.method = undefined

    this.methods._all = true
    this.stack.push(layer)
  }

  return this
}

methods.forEach(function(method) {
  Route.prototype[method] = function() {
    var handlers = flatten(slice.call(arguments))

    for (var i = 0; i < handlers.length; i++) {
      var handler = handlers[i]

      if (typeof handler !== 'function') {
        var type = toString.call(handler)
        var msg = 'Route.' + method + '() requires a callback function but got a ' + type
        throw new TypeError(msg)
      }

      debug('%s %o', method, this.path)

      var layer = new Layer('/', {}, handler)
      layer.method = method

      this.methods[method] = true
      this.stack.push(layer)
    }

    return this
  }
})

/**
 * use the alias `del` method for `delete`
 */
Route.prototype.del = Route.prototype.delete
