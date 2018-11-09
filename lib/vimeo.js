'use strict'

/**
 *   Copyright 2013 Vimeo
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
var qsModule = require('querystring')
var urlModule = require('url')
var httpModule = require('http')
var httpsModule = require('https')
var fs = require('fs')
var path = require('path')
var tus = require('tus-js-client')

module.exports.request_defaults = {
  protocol: 'https:',
  hostname: 'api.vimeo.com',
  port: 443,
  method: 'GET',
  query: {},
  headers: {
    Accept: 'application/vnd.vimeo.*+json;version=3.4',
    'User-Agent': 'Vimeo.js/2.1.1'
  }
}

var authEndpoints = module.exports.authEndpoints = {
  authorization: '/oauth/authorize',
  accessToken: '/oauth/access_token',
  clientCredentials: '/oauth/authorize/client'
}

/**
 * This object is used to interface with the Vimeo API.
 *
 * @param {string} clientId     OAuth 2 Client Identifier
 * @param {string} clientSecret OAuth 2 Client Secret
 * @param {string} accessToken  OAuth 2 Optional pre-authorized access token
 */
var Vimeo = module.exports.Vimeo = function Vimeo (clientId, clientSecret, accessToken) {
  this._clientId = clientId
  this._clientSecret = clientSecret

  if (accessToken) {
    this._accessToken = accessToken
  }
}

Vimeo.prototype._clientId = null
Vimeo.prototype._clientSecret = null
Vimeo.prototype._accessToken = null

/**
 * Performs an API call.
 *
 * Can be called one of two ways:
 *
 * 1. Url + Callback
 *    If a url is provided, we fill in the rest of the request options with defaults
 *    (GET http://api.vimeo.com/{url}).
 *
 * 2. Options + callback
 *    If an object is provided, it should match the response of urlModule.parse. Path is the only
 *    required parameter.
 *
 *    - hostname
 *    - port
 *    - query (will be applied to the url if GET, request body if POST)
 *    - headers
 *    - path (can include a querystring)
 *    - method
 *
 * The callback takes two parameters, `err` and `json`.
 * If an error has occured, your callback will be called as `callback(err)`;
 * If an error has not occured, your callback will be called as `callback(null, json)`;
 *
 * @param {string|Object} options   String path (default GET), or object with `method`, path`,
 *                                  `host`, `port`, `query` or `headers`.
 * @param {Function}      callback  Called when complete, `function (err, json)`.
 */
Vimeo.prototype.request = function (options, callback) {
  var client = null

  // If a URL was provided, build an options object.
  if (typeof options === 'string') {
    options = urlModule.parse(options, true)
    options.method = 'GET'
  }

  // If we don't have a path at this point, error. a path is the only required field. We have
  // defaults for everything else important.
  if (typeof options.path !== 'string') {
    return callback(new Error('You must provide an API path.'))
  }

  // Add leading slash to path if missing
  if (options.path.charAt(0) !== '/') {
    options.path = '/' + options.path
  }

  // Turn the provided options into options that are valid for `client.request`.
  var requestOptions = this._buildRequestOptions(options)

  client = requestOptions.protocol === 'https:' ? httpsModule : httpModule

  if (['POST', 'PATCH', 'PUT', 'DELETE'].indexOf(requestOptions.method) !== -1) {
    if (requestOptions.headers['Content-Type'] === 'application/json') {
      requestOptions.body = JSON.stringify(options.query)
    } else {
      requestOptions.body = qsModule.stringify(options.query)
    }

    if (requestOptions.body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(requestOptions.body, 'utf8')
    } else {
      requestOptions.headers['Content-Length'] = 0
    }
  }

  // Perform the Vimeo API request
  var req = client.request(requestOptions, this._handleRequest(callback))
  if (requestOptions.body) {
    req.write(requestOptions.body)
  }

  req.on('error', function (e) {
    callback(e)
  })

  req.end()
}

/**
 * Creates the standard request handler for http requests
 *
 * @param  {Function} callback
 * @return {Function}
 */
Vimeo.prototype._handleRequest = function (callback) {
  return function (res) {
    res.setEncoding('utf8')

    var buffer = ''

    res.on('readable', function () {
      buffer += res.read() || ''
    })

    if (res.statusCode >= 400) {
      // Failed api calls should wait for the response to end and then call the callback with an
      // error.
      res.on('end', function () {
        var err = new Error(buffer)
        callback(err, buffer, res.statusCode, res.headers)
      })
    } else {
      // Successful api calls should wait for the response to end and then call the callback with
      // the response body.
      res.on('end', function () {
        try {
          var body = buffer.length ? JSON.parse(buffer) : {}
        } catch (e) {
          return callback(buffer, buffer, res.statusCode, res.headers)
        }

        callback(null, body, res.statusCode, res.headers)
      })
    }
  }
}

/**
 * Merge the request options defaults into the request options
 *
 * @param  {Object} options
 * @return {Object}
 */
Vimeo.prototype._buildRequestOptions = function (options) {
  // Set up the request object. we always use the options paramter first, and if no value is
  // provided we fall back to request defaults.
  var requestOptions = this._applyDefaultRequestOptions(options)

  if (this._accessToken) {
    requestOptions.headers.Authorization = 'Bearer ' + this._accessToken
  } else if (this._clientId && this._clientSecret) {
    var basicToken = Buffer.from(this._clientId + ':' + this._clientSecret)
    requestOptions.headers.Authorization = 'Basic ' + basicToken.toString('base64')
  }

  if (['POST', 'PATCH', 'PUT', 'DELETE'].indexOf(requestOptions.method) !== -1 &&
    !requestOptions.headers['Content-Type']
  ) {
    // Set proper headers for POST, PATCH and PUT bodies.
    requestOptions.headers['Content-Type'] = 'application/json'
  } else if (requestOptions.method === 'GET') {
    // Apply parameters to the URL for GET requests.
    requestOptions.path = this._applyQuerystringParams(requestOptions, options)
  }

  return requestOptions
}

/**
 * Create an object of request options based on the provided list of options, and the request
 * defaults.
 *
 * @param  {Object} options
 * @return {Object}
 */
Vimeo.prototype._applyDefaultRequestOptions = function (options) {
  var requestOptions = {
    protocol: options.protocol || module.exports.request_defaults.protocol,
    host: options.hostname || module.exports.request_defaults.hostname,
    port: options.port || module.exports.request_defaults.port,
    method: options.method || module.exports.request_defaults.method,
    headers: options.headers || {},
    body: '',
    path: options.path
  }

  var key = null

  // Apply the default headers
  if (module.exports.request_defaults.headers) {
    for (key in module.exports.request_defaults.headers) {
      if (!requestOptions.headers[key]) {
        requestOptions.headers[key] = module.exports.request_defaults.headers[key]
      }
    }
  }

  return requestOptions
}

/**
 * Apply the query parameter onto the final request URL.
 *
 * @param  {Object} requestOptions
 * @param  {Object} options
 * @return {string}
 */
Vimeo.prototype._applyQuerystringParams = function (requestOptions, options) {
  var querystring = ''

  if (!options.query) {
    return requestOptions.path
  }

  // If we have parameters, apply them to the URL.
  if (Object.keys(options.query).length) {
    if (requestOptions.path.indexOf('?') < 0) {
      // If the existing path does not contain any parameters, apply them as the only options.
      querystring = '?' + qsModule.stringify(options.query)
    } else {
      // If the user already added parameters to the URL, we want to add them as additional
      // parameters.
      querystring = '&' + qsModule.stringify(options.query)
    }
  }

  return requestOptions.path + querystring
}

/**
 * Set a user access token to be used with library requests.
 *
 * @param {string} accessToken
 */
Vimeo.prototype.setAccessToken = function (accessToken) {
  this._accessToken = accessToken
}

/**
 * Exchange a code for an access token. This code should exist on your `redirectUri`.
 *
 * @param {string}   code         The code provided on your `redirectUri`.
 * @param {string}   redirectUri  The exact `redirectUri` provided to `buildAuthorizationEndpoint`
 *                                and configured in your API app settings.
 * @param {Function} fn           Callback to execute on completion.
 */
Vimeo.prototype.accessToken = function (code, redirectUri, fn) {
  var options = {
    method: 'POST',
    hostname: module.exports.request_defaults.hostname,
    path: authEndpoints.accessToken,
    query: {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  this.request(options, function (err, body, status, headers) {
    if (err) {
      return fn(err, null, status, headers)
    } else {
      fn(null, body, status, headers)
    }
  })
}

/**
 * The first step of the authorization process.
 *
 * This function returns a URL, which the user should be sent to (via redirect or link).
 *
 * The destination allows the user to accept or deny connecting with vimeo, and accept or deny each
 * of the scopes you requested. Scopes are passed through the second parameter as an array of
 * strings, or a space delimited list.
 *
 * Once accepted or denied, the user is redirected back to the `redirectUri`.
 *
 * @param  {string} redirectUri   The URI that will exchange a code for an access token. Must match
 *                                the URI in your API app settings.
 * @param  {string} scope         An array of scopes. See https://developer.vimeo.com/api/authentication#scopes
 *                                for more.
 * @param  {string} state         A unique state that will be returned to you on your redirect URI.
 */
Vimeo.prototype.buildAuthorizationEndpoint = function (redirectUri, scope, state) {
  var query = {
    response_type: 'code',
    client_id: this._clientId,
    redirect_uri: redirectUri
  }

  if (scope) {
    if (Array.isArray(scope)) {
      query.scope = scope.join(' ')
    } else {
      query.scope = scope
    }
  } else {
    query.scope = 'public'
  }

  if (state) {
    query.state = state
  }

  return module.exports.request_defaults.protocol +
    '//' +
    module.exports.request_defaults.hostname +
    authEndpoints.authorization +
    '?' +
    qsModule.stringify(query)
}

/**
 * Generates an unauthenticated access token. This is necessary to make unauthenticated requests
 *
 * @param  {string}   scope An array of scopes. See https://developer.vimeo.com/api/authentication#scopes
 *                          for more.
 * @param  {Function} fn    A function that is called when the request is complete. If an error
 *                          occured the first parameter will be that error, otherwise the first
 *                          parameter will be null.
 */
Vimeo.prototype.generateClientCredentials = function (scope, fn) {
  var query = {
    grant_type: 'client_credentials'
  }

  if (scope) {
    if (Array.isArray(scope)) {
      query.scope = scope.join(' ')
    } else {
      query.scope = scope
    }
  } else {
    query.scope = 'public'
  }

  this.request({
    method: 'POST',
    hostname: module.exports.request_defaults.hostname,
    path: authEndpoints.clientCredentials,
    query: query,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, function (err, body, status, headers) {
    if (err) {
      return fn(err, null, status, headers)
    } else {
      fn(null, body, status, headers)
    }
  })
}

/**
 * Upload a file.
 *
 * This should be used to upload a local file. If you want a form for your site to upload direct to
 * Vimeo, you should look at the `POST /me/videos` endpoint.
 *
 * https://developer.vimeo.com/api/endpoints/videos#POST/users/{user_id}/videos
 *
 * @param {string}    filePath          Path to the file you wish to upload.
 * @param {object=}   params            Parameters to send when creating a new video (name,
 *                                      privacy restrictions, etc.). See the API documentation for
 *                                      supported parameters.
 * @param {Function}  completeCallback  Callback to be executed when the upload completes.
 * @param {Function}  progressCallback  Callback to be executed when upload progress is updated.
 * @param {Function}  errorCallback     Callback to be executed when the upload returns an error.
 */
Vimeo.prototype.upload = function (
  file,
  params,
  completeCallback,
  progressCallback,
  errorCallback
) {
  var _self = this
  var fileSize

  if (typeof params === 'function') {
    errorCallback = progressCallback
    progressCallback = completeCallback
    completeCallback = params
    params = {}
  }

  if (typeof file === 'string') {
    try {
      fileSize = fs.statSync(file).size
    } catch (e) {
      return errorCallback('Unable to locate file to upload.')
    }
  } else {
    fileSize = file.size
  }

  // Ignore any specified upload approach and size.
  if (typeof params.upload === 'undefined') {
    params.upload = {
      'approach': 'tus',
      'size': fileSize
    }
  } else {
    params.upload.approach = 'tus'
    params.upload.size = fileSize
  }

  var options = {
    path: '/me/videos?fields=uri,name,upload',
    method: 'POST',
    query: params
  }

  // Use JSON filtering so we only receive the data that we need to make an upload happen.
  this.request(options, function (err, attempt, status) {
    if (err) {
      return errorCallback('Unable to initiate an upload. [' + err + ']')
    }

    _self._performTusUpload(
      file,
      fileSize,
      attempt,
      completeCallback,
      progressCallback,
      errorCallback
    )
  })
}

/**
 * Replace the source of a single Vimeo video.
 *
 * https://developer.vimeo.com/api/endpoints/videos#POST/videos/{video_id}/versions
 *
 * @param {string}    filePath          Path to the file you wish to upload.
 * @param {string}    videoUri          Video URI of the video file to replace.
 * @param {object=}   params            Parameters to send when creating a new video (name,
 *                                      privacy restrictions, etc.). See the API documentation for
 *                                      supported parameters.
 * @param {Function}  completeCallback  Callback to be executed when the upload completes.
 * @param {Function}  progressCallback  Callback to be executed when upload progress is updated.
 * @param {Function}  errorCallback     Callback to be executed when the upload returns an error.
 */
Vimeo.prototype.replace = function (
  file,
  videoUri,
  params,
  completeCallback,
  progressCallback,
  errorCallback
) {
  var _self = this
  var fileSize

  if (typeof params === 'function') {
    errorCallback = progressCallback
    progressCallback = completeCallback
    completeCallback = params
    params = {}
  }

  if (typeof file === 'string') {
    try {
      fileSize = fs.statSync(file).size
    } catch (e) {
      return errorCallback('Unable to locate file to upload.')
    }

    params.file_name = path.basename(file)
  } else {
    fileSize = file.size
    params.file_name = file.name
  }

  // Ignore any specified upload approach and size.
  if (typeof params.upload === 'undefined') {
    params.upload = {
      'approach': 'tus',
      'size': fileSize
    }
  } else {
    params.upload.approach = 'tus'
    params.upload.size = fileSize
  }

  var options = {
    path: videoUri + '/versions?fields=upload',
    method: 'POST',
    query: params
  }

  // Use JSON filtering so we only receive the data that we need to make an upload happen.
  _self.request(options, function (err, attempt, status) {
    if (err) {
      return errorCallback('Unable to initiate an upload. [' + err + ']')
    }

    attempt.uri = videoUri

    _self._performTusUpload(
      file,
      fileSize,
      attempt,
      completeCallback,
      progressCallback,
      errorCallback
    )
  })
}

/**
 * Take an upload attempt and perform the actual upload via tus.
 *
 * https://tus.io/
 *
 * @param {string}    filePath          Path to the file you wish to upload.
 * @param {integer}   fileSize          Size of the file that will be uploaded.
 * @param {Object}    attempt           Upload attempt data.
 * @param {Function}  completeCallback  Callback to be executed when the upload completes.
 * @param {Function}  progressCallback  Callback to be executed when the upload progress is updated.
 * @param {Function}  errorCallback     Callback to be executed when the upload returns an error.
 */
Vimeo.prototype._performTusUpload = function (
  file,
  fileSize,
  attempt,
  completeCallback,
  progressCallback,
  errorCallback
) {
  var fileUpload = file

  if (typeof file === 'string') {
    fileUpload = fs.createReadStream(file)
  }

  var upload = new tus.Upload(fileUpload, {
    endpoint: 'none',
    uploadSize: fileSize,
    retryDelays: [0, 1000, 3000, 5000],
    onError: errorCallback,
    onProgress: progressCallback,
    onSuccess: function () {
      return completeCallback(attempt.uri)
    }
  })

  upload.url = attempt.upload.upload_link
  upload.start()
}
