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
const qsModule = require('querystring')
const urlModule = require('url')
const httpModule = require('http')
const httpsModule = require('https')
const fs = require('fs')
const path = require('path')
const tus = require('tus-js-client')

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

const authEndpoints = module.exports.authEndpoints = {
  authorization: '/oauth/authorize',
  accessToken: '/oauth/access_token',
  clientCredentials: '/oauth/authorize/client'
}

/**
 * This object is used to interface with the Vimeo API.
 *
 * @param {string} clientId     OAuth 2 Client Identifier
 * @param {string} clientSecret OAuth 2 Client Secret
 * @param {string} [accessToken]  OAuth 2 Optional pre-authorized access token
 */
const Vimeo = module.exports.Vimeo = function Vimeo (clientId, clientSecret, accessToken) {
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
 * Can be implemented using a Callback or a Promise:
 *
 * .request( Url | Options [, Callback])
 *
 * -  Url <string>
 *    If a url is provided, we fill in the rest of the request options with defaults
 *    (GET http://api.vimeo.com/{url}).
 *
 * -  Options <Object>
 *    If an object is provided, it should match the response of urlModule.parse. Path is the only
 *    required parameter.
 *
 *    - hostname
 *    - port
 *    - query (will be applied to the url if GET, request body if POST with content type application/x-www-form-urlencoded or application/json)
 *    - headers
 *    - path (can include a querystring)
 *    - method
 *    - body (will be applied to request body if POST with content type that is not application/x-www-form-urlencoded or application/json)
 *
 * -  Callback (optional)
 *    The callback takes two parameters, `err` and `json`.
 *    If an error has occured, your callback will be called as `callback(err)`;
 *    If an error has not occured, your callback will be called as `callback(null, json)`;
 *    If not passed in, a Promise will be returned.
 *
 * @param {string|Object} options   String path (default GET), or object with `method`, path`,
 *                                  `host`, `port`, `query`, `body`, or `headers`.
 * @param {Function} [callback]     (optional) Called when complete, `function (err, json)`. If not passed in, a Promise will be returned.
 */
Vimeo.prototype.request = function (options, callback) {
  let client = null

  // If a URL was provided, build an options object.
  if (typeof options === 'string') {
    options = urlModule.parse(options, true) // eslint-disable-line n/no-deprecated-api
    options.method = 'GET'
  }

  // If we don't have a path at this point, error. a path is the only required field. We have
  // defaults for everything else important.
  if (typeof options.path !== 'string') {
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        reject(new Error('You must provide an API path.'))
      })
    } else {
      return callback(new Error('You must provide an API path.'))
    }
  }

  // Add leading slash to path if missing
  if (options.path.charAt(0) !== '/') {
    options.path = '/' + options.path
  }

  // Turn the provided options into options that are valid for `client.request`.
  const requestOptions = this._buildRequestOptions(options)

  client = requestOptions.protocol === 'https:' ? httpsModule : httpModule

  if (['POST', 'PATCH', 'PUT', 'DELETE'].indexOf(requestOptions.method) !== -1) {
    if (requestOptions.headers['Content-Type'] === 'application/json') {
      requestOptions.body = JSON.stringify(options.query)
    } else if (requestOptions.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      requestOptions.body = qsModule.stringify(options.query)
    } else {
      requestOptions.body = options.body
    }

    if (requestOptions.body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(requestOptions.body, 'utf8')
    } else {
      requestOptions.headers['Content-Length'] = 0
    }
  }

  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      const req = client.request(requestOptions, this._handleRequest(resolve, reject))

      if (requestOptions.body) {
        req.write(requestOptions.body)
      }

      req.on('error', function (e) {
        reject(e)
      })

      req.end()
    })
  } else {
    // Perform the Vimeo API request
    const req = client.request(requestOptions, this._handleRequest(callback))
    if (requestOptions.body) {
      req.write(requestOptions.body)
    }

    req.on('error', function (e) {
      callback(e)
    })

    req.end()
  }
}

/**
 * Creates the standard request handler for http requests
 *
 * @param  {Function} callback
 * @param  {Function} [reject] (optional) used when called inside a Promise
 * @return {Function}
 */
Vimeo.prototype._handleRequest = function (callback, reject) {
  const isPromise = reject !== undefined
  reject = reject || callback

  return function (res) {
    res.setEncoding('utf8')

    let buffer = ''

    res.on('readable', function () {
      buffer += res.read() || ''
    })

    if (res.statusCode >= 400) {
      // Failed api calls should wait for the response to end and then call the callback or the reject fn if passed in with an
      // error.
      res.on('end', function () {
        const err = new Error(buffer)
        reject(err, buffer, res.statusCode, res.headers)
      })
    } else {
      // Successful api calls should wait for the response to end and then call the callback with
      // the response body.
      let body = null
      res.on('end', function () {
        try {
          body = buffer.length ? JSON.parse(buffer) : {}

          if (isPromise) {
            const callbackData = { statusCode: res.statusCode, body, headers: res.headers }
            callback(callbackData)
          } else {
            callback(null, body, res.statusCode, res.headers)
          }
        } catch (err) {
          return reject(err, buffer, res.statusCode, res.headers)
        }
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
  const requestOptions = this._applyDefaultRequestOptions(options)

  if (this._accessToken) {
    requestOptions.headers.Authorization = 'Bearer ' + this._accessToken
  } else if (this._clientId && this._clientSecret) {
    const basicToken = Buffer.from(this._clientId + ':' + this._clientSecret)
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
  const requestOptions = {
    protocol: options.protocol || module.exports.request_defaults.protocol,
    host: options.hostname || module.exports.request_defaults.hostname,
    port: options.port || module.exports.request_defaults.port,
    method: options.method || module.exports.request_defaults.method,
    headers: options.headers || {},
    body: '',
    path: options.path
  }

  let key = null

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
 * @param  {string} requestOptions.path
 * @param  {Object} options
 * @param  {string} options.query
 * @return {string}
 */
Vimeo.prototype._applyQuerystringParams = function (requestOptions, options) {
  let querystring = ''

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
 * @param {Function} [fn]         (optional) Callback to execute on completion. If not passed in, a Promise will be returned.
 */
Vimeo.prototype.accessToken = function (code, redirectUri, fn) {
  const options = {
    method: 'POST',
    hostname: module.exports.request_defaults.hostname,
    path: authEndpoints.accessToken,
    query: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  if (fn === undefined) {
    return this.request(options)
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
 * @param  {string|string[]} scope  An array of scopes. See https://developer.vimeo.com/api/authentication#scopes
 *                                for more.
 * @param  {string} state         A unique state that will be returned to you on your redirect URI.
 */
Vimeo.prototype.buildAuthorizationEndpoint = function (redirectUri, scope, state) {
  const query = {
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
 * @param  {string|string[]} scope  An array of scopes. See https://developer.vimeo.com/api/authentication#scopes
 *                                  for more.
 * @param  {Function}        [fn]   (optional) A function that is called when the request is complete. If an error
 *                                  occured the first parameter will be that error, otherwise the first
 *                                  parameter will be null. If not passed in, a Promise will be returned.
 */
Vimeo.prototype.generateClientCredentials = function (scope, fn) {
  const query = {
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

  const options = {
    method: 'POST',
    hostname: module.exports.request_defaults.hostname,
    path: authEndpoints.clientCredentials,
    query,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  if (fn === undefined) {
    return this.request(options)
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
 * Upload a file.
 *
 * This should be used to upload a local file. If you want a form for your site to upload direct to
 * Vimeo, you should look at the `POST /me/videos` endpoint.
 *
 * https://developer.vimeo.com/api/reference/videos#upload_video
 *
 * .upload( file [, params] [, completeCallback], progressCallback [, errorCallback])
 *
 * -  params (optional)
 *    If an object is not provided, default upload params are used.
 *
 * -  completeCallback and errorCallback (optional)
 *    If neither passed in, a Promise will be returned.
 *    Ex. vimeo.upload(file, progressCallback) or vimeo.upload(file, params, progressCallback)
 *
 * @param {string}    file                Path to the file you wish to upload.
 * @param {Object=}   [params]            (optional) Parameters to send when creating a new video (name,
 *                                        privacy restrictions, etc.). See the API documentation for
 *                                        supported parameters.
 * @param {Function}  [completeCallback]  (optional) Callback to be executed when the upload completes.
 * @param {Function}  progressCallback    Callback to be executed when upload progress is updated.
 * @param {Function}  [errorCallback]     (optional) Callback to be executed when the upload returns an error.
 */
Vimeo.prototype.upload = function (
  file,
  params,
  completeCallback,
  progressCallback,
  errorCallback
) {
  const _self = this
  let fileSize

  if (typeof params === 'function') {
    errorCallback = progressCallback
    progressCallback = completeCallback
    completeCallback = params
    params = {}
  }

  const isPromise = progressCallback === undefined && errorCallback === undefined

  if (isPromise) {
    progressCallback = completeCallback
  }

  if (typeof file === 'string') {
    try {
      fileSize = fs.statSync(file).size
    } catch (e) {
      if (isPromise) {
        return new Promise((resolve, reject) => reject(e))
      }

      return errorCallback('Unable to locate file to upload.')
    }
  } else {
    const error = new Error('Please pass in a valid file path.')
    if (isPromise) {
      return new Promise((resolve, reject) => reject(error))
    }
    return errorCallback(error)
  }

  // Ignore any specified upload approach and size.
  if (typeof params.upload === 'undefined') {
    params.upload = {
      approach: 'tus',
      size: fileSize
    }
  } else {
    params.upload.approach = 'tus'
    params.upload.size = fileSize
  }

  const options = {
    path: '/me/videos?fields=uri,name,upload',
    method: 'POST',
    query: params
  }

  if (isPromise) {
    return new Promise((resolve, reject) => {
      this.request(options).then(attempt => {
        _self._performTusUpload(
          file,
          fileSize,
          attempt.body,
          resolve,
          progressCallback,
          reject
        )
      }).catch(err => {
        reject(new Error('Unable to initiate an upload. [' + err.message + ']'))
      })
    })
  }

  // Use JSON filtering so we only receive the data that we need to make an upload happen.
  this.request(options, function (err, attempt) {
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
 * https://developer.vimeo.com/api/reference/videos#create_video_version
 *
 * .replace( file, videoUri [, params] [, completeCallback], progressCallback [, errorCallback])
 *
 * -  params (optional)
 *    If an object is not provided, default upload params are used.
 *
 * -  completeCallback and errorCallback (optional)
 *    If neither passed in, a Promise will be returned.
 *    Ex. vimeo.replace(file, videoUri, progressCallback) or vimeo.replace(file, videoUri, params, progressCallback)
 *
 * @param {string}    file                Path to the file you wish to upload.
 * @param {string}    videoUri            Video URI of the video file to replace.
 * @param {Object=}   [params]            (optional) Parameters to send when creating a new video (name,
 *                                        privacy restrictions, etc.). See the API documentation for
 *                                        supported parameters.
 * @param {Function}  [completeCallback]  (optional) Callback to be executed when the upload completes.
 * @param {Function}  progressCallback    Callback to be executed when upload progress is updated.
 * @param {Function}  [errorCallback]     (optional) Callback to be executed when the upload returns an error.
 */
Vimeo.prototype.replace = function (
  file,
  videoUri,
  params,
  completeCallback,
  progressCallback,
  errorCallback
) {
  const _self = this
  let fileSize

  if (typeof params === 'function') {
    errorCallback = progressCallback
    progressCallback = completeCallback
    completeCallback = params
    params = {}
  }

  const isPromise = progressCallback === undefined && errorCallback === undefined

  if (isPromise) {
    progressCallback = completeCallback
  }

  if (typeof file === 'string') {
    try {
      fileSize = fs.statSync(file).size
    } catch (e) {
      if (isPromise) {
        return new Promise((resolve, reject) => reject(e))
      }

      return errorCallback('Unable to locate file to upload.')
    }

    params.file_name = path.basename(file)
  } else {
    const error = new Error('Please pass in a valid file path.')
    if (isPromise) {
      return new Promise((resolve, reject) => reject(error))
    }

    return errorCallback(error)
  }

  // Ignore any specified upload approach and size.
  if (typeof params.upload === 'undefined') {
    params.upload = {
      approach: 'tus',
      size: fileSize
    }
  } else {
    params.upload.approach = 'tus'
    params.upload.size = fileSize
  }

  const options = {
    path: videoUri + '/versions?fields=upload',
    method: 'POST',
    query: params
  }

  if (isPromise) {
    return new Promise((resolve, reject) => {
      this.request(options).then(attempt => {
        attempt.body.uri = videoUri

        _self._performTusUpload(
          file,
          fileSize,
          attempt.body,
          resolve,
          progressCallback,
          reject
        )
      })
        .catch(err => {
          reject(new Error('Unable to initiate an upload. [' + err.message + ']'))
        })
    })
  }

  // Use JSON filtering so we only receive the data that we need to make an upload happen.
  _self.request(options, function (err, attempt) {
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
 * @param {string}    file          Path to the file you wish to upload.
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
  let fileUpload = file

  if (typeof file === 'string') {
    fileUpload = fs.createReadStream(file)
  }

  const upload = new tus.Upload(fileUpload, {
    uploadUrl: attempt.upload.upload_link,
    uploadSize: fileSize,
    retryDelays: [0, 1000, 3000, 5000],
    onError: errorCallback,
    onProgress: progressCallback,
    onSuccess: function () {
      return completeCallback(attempt.uri)
    }
  })

  upload.start()
}
