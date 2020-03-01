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

var pathToRegexp = require('path-to-regexp').pathToRegexp
var debug = require('debug')('koa2-router:layer')

/**
 * Module variables.
 * @private
 */

var hasOwnProperty = Object.prototype.hasOwnProperty

/**
 * Module exports.
 * @public
 */

module.exports = Layer

function Layer(path, options, fn) {
  if (!(this instanceof Layer)) {
    return new Layer(path, options, fn)
  }

  debug('new %o', path)
  var opts = options || {}

  this.handler = fn
  this.name = fn._name || fn.name || '<anonymous>'
  this.regexp = pathToRegexp(path, this.keys = [], opts)

  // temperary matched result for faster matching
  this.path = undefined
  this.params = undefined

  // set fast path flags
  this.regexp.fast_star = path === '*'
  this.regexp.fast_slash = path === '/' && opts.end === false
}

/**
 * Handle the request for the layer.
 *
 * @param {Koa.Context} ctx
 * @param {function} next
 * @api private
 */

Layer.prototype.handle = async function handle(ctx, next) {
  var fn = this.handler
  // .user(mw), use('/', mw) or use('*', mw)
  if (!this.route && (this.regexp.fast_slash ||
      this.regexp.fast_star)) {
    await fn(ctx, next)
    return
  }

  // .route()/.use([prefix])/[method]()
  var isNextCalled = false

  function onNextCalled() {
    isNextCalled = true
  }

  function tryNext() {
    // only call next if next() is called and ctx
    // is not responded
    if (!isNextCalled || ctx.responded) return
    return next()
  }

  await fn(ctx, onNextCalled)
  await tryNext()
}

/**
 * Check if this route matches `path`, if so
 * populate `.params`, `.path` properties for temporary usage.
 *
 * @param {String} path
 * @return {Boolean}
 * @api private
 */

Layer.prototype.match = function match(path) {
  var match

  if (path != null) {
    // fast path non-ending match for / (any path matches)
    if (this.regexp.fast_slash) {
      this.params = {}
      this.path = ''
      return true
    }

    // fast path for * (everything matched in a param)
    if (this.regexp.fast_star) {
      this.params = {'0': decode_param(path)}
      this.path = path
      return true
    }

    // match the path
    match = this.regexp.exec(path)
  }

  if (!match) {
    this.params = undefined
    this.path = undefined
    return false
  }

  // store values
  this.params = {}
  this.path = match[0]

  // iterate matches
  var keys = this.keys
  var params = this.params

  for (var i = 1; i < match.length; i++) {
    var key = keys[i - 1]
    var prop = key.name
    var val = decode_param(match[i])

    if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
      params[prop] = val
    }
  }

  return true
}

/**
 * Decode param value.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function decode_param(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val
  }

  try {
    return decodeURIComponent(val)
  } catch (err) {
    if (err instanceof URIError) {
      err.message = 'Failed to decode param \'' + val + '\''
      err.status = err.statusCode = 400
    }

    throw err
  }
}
