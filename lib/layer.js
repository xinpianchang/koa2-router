/*!
 * koa2-router
 * Copyright(c) 2018-2019 xinpianchang.com
 * Copyright(c) 2019 Tang Ye
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var pathRegexp = require('path-to-regexp');
var debug = require('debug')('koa2-router:layer');

/**
 * Module variables.
 * @private
 */

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Module exports.
 * @public
 */

module.exports = Layer;

function Layer(path, options, fn) {
  if (!(this instanceof Layer)) {
    return new Layer(path, options, fn);
  }

  debug('new %o', path)
  var opts = options || {};

  this.handler = fn;
  this.name = fn._name || fn.name || '<anonymous>';
  this.regexp = pathRegexp(path, this.keys = [], opts);

  // set fast path flags
  this.regexp.fast_star = path === '*';
  this.regexp.fast_slash = path === '/' && opts.end === false;
}

/**
 * Handle the request for the layer.
 *
 * @param {Koa.Context} ctx
 * @param {function} next
 * @api private
 */

Layer.prototype.handle = async function handle(ctx, next) {
  var fn = this.handler;
  await fn(ctx, next);
};

/**
 * Check if this route matches `path`, if so
 * populate `.params` and `.path` for temporary usage.
 *
 * @param {String} path
 * @return {Object}
 * @api private
 */

Layer.prototype.match = function match(path) {
  var match;

  if (path != null) {
    // fast path non-ending match for / (any path matches)
    if (this.regexp.fast_slash) {
      return {
        params: {},
        path: '',
        matched: true,
      };
    }

    // fast path for * (everything matched in a param)
    if (this.regexp.fast_star) {
      return {
        params: {'0': decode_param(path)},
        path: path,
        matched: true,
      };
    }

    // match the path
    match = this.regexp.exec(path);
  }

  if (!match) {
    return { matched: false };
  }

  var keys = this.keys;
  var params = {};

  // store values
  var result = {
    params: params,
    path: match[0],
    matched: true,
  };

  for (var i = 1; i < match.length; i++) {
    var key = keys[i - 1];
    var prop = key.name;
    var val = decode_param(match[i]);

    if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
      params[prop] = val;
    }
  }

  return result;
};

/**
 * Decode param value.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function decode_param(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val;
  }

  try {
    return decodeURIComponent(val);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = 'Failed to decode param \'' + val + '\'';
      err.status = err.statusCode = 400;
    }

    throw err;
  }
}
