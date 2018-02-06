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

var Vimeo = require('../index').Vimeo
var utilModule = require('util')

try {
  var config = require('./config.json')
} catch (error) {
  console.error('ERROR: For this example to run properly you must create an API app at ' +
    'https://developer.vimeo.com/apps/new and set your callback url to ' +
    '`http://localhost:8080/oauth_callback`.')
  console.error('ERROR: Once you have your app, make a copy of `config.json.example` named ' +
    '`config.json` and add your client ID, client secret and access token.')
  process.exit()
}

var httpModule = require('http')
var urlModule = require('url')

var stateData = {
  state: 'unauthorized'
}

// Here we have to build the Vimeo library using the configured `client_id` and `client_secret`. We
// do not need an access token here because we will generate one. If we already knew our access
// token, we can provide it as the third parameter.
var lib = new Vimeo(config.client_id, config.client_secret)

var scopes = ['public', 'private', 'edit', 'interact']
var callbackUrl = 'http://localhost:8080/oauth_callback'

// The authorization process requires the user to be redirected back to a webpage, so we can start
// up a simple HTTP server here.
var server = httpModule.createServer(function (request, response) {
  var url = urlModule.parse(request.url, true)

  // Once the user accepts your app, they will be redirected back to
  // `http://localhost:8080/oauth_callback`. If they are not redirected you should check your apps
  // configuration at https://developer.vimeo.com/apps.
  if (url.pathname === '/oauth_callback') {
    if (url.query.state !== 'abcdefg') {
      throw new Error('invalid state')
    }

    if (!url.query.error) {
      // At this state, a request to `/oauth_callback` without an error parameter, the user has been
      // redirected back to the app and you can exchange the "code" parameter for an access token.
      console.info('successful oauth callback request')
      lib.accessToken(url.query.code, callbackUrl, function (err, token) {
        if (err) {
          return response.end('error=\n' + err)
        }

        if (token.access_token) {
          // At this state the code has been successfully exchanged for an access token
          lib.setAccessToken(token.access_token)
          stateData.user = token.user
          stateData.state = 'authorized'
          response.statusCode = 302
          response.setHeader('Location', '/')
          response.end()
        } else {
          throw new Error('no access token provided')
        }
      })
    } else {
      // At this state, a request to `/oauth_callback` with an error parameter, something went wrong
      // when you sent your user to Vimeo. The error parameter should tell you more.
      console.error('failed oauth callback request')
      console.error(url.query.error)

      response.setHeader('Content-Type', 'text/html')
      response.write('<p>Your command line is currently unauthenticated. Please ' +
        '<a href="' + lib.buildAuthorizationEndpoint(callbackUrl, scopes, 'abcdefg') + '">' +
        'Link with Vimeo</a></p>')
      response.write('<code>' + JSON.stringify(url.query) + '</code>')
      response.end()
    }
  } else {
    if (stateData.state !== 'authorized') {
      // At this state, any request where `stateData.state` has not been set to "authorized", we do
      // not have an authentication token, so we need to send the user to Vimeo.
      console.info('HTTP request without access token.')
      response.setHeader('Content-Type', 'text/html')
      response.write('<p>Your command line is currently unauthenticated. Please ' +
        '<a href="' + lib.buildAuthorizationEndpoint(callbackUrl, scopes, 'abcdefg') +
        '">Link with Vimeo</a></p>')
      response.end()
    } else {
      // At this state, `stateData.state` has been set to "authorized" when we retrieved the access
      // token, we can make authenticated API requests.
      console.info('HTTP request with access token.')
      response.setHeader('Content-Type', 'text/html')
      response.write('<p>Your command line is currently authorized with the user: <a href="' +
        stateData.user.link + '">' + stateData.user.name + '</a>.</p>')
      response.write('<p>You can make API requests via the command line using the "request" ' +
        'function, or upload files using the "upload" function.</p>')
      response.write('<p>Try "request(\'/me\');"</p>')
      response.end()
    }
  }
})

server.listen(8080, function () {
  console.log('Server started on 8080. Open up http://localhost:8080 in your browser.')
})

var context = require('repl').start({}).context

/**
 * This will upload the video to the authenticated account.
 *
 * @param  {string} path      The path to the video file.
 * @param  {string=} videoUri If provided, this upload will replace the source file of the video URI
 *                            provided.
 */
context.upload = function (path, videoUri) {
  lib.streamingUpload(path, videoUri, function (err, data, status, headers) {
    if (err) {
      console.log('---upload error---')
      console.log('error')
      console.log(err)
      console.log('response body')
      console.log(data)
      console.log('response status')
      console.log(status)
      console.log('response headers')
      console.log(headers)
    } else {
      console.log('---upload success---')
      console.log('response body')
      console.log(data)
      console.log('response status')
      console.log(status)
      console.log('response headers')
      console.log(headers)
    }
  })
}

/**
 * This method lets you make API requests.
 *
 *  - `options.method` is a string of the HTTP method for the request (GET, POST, PUT, PATCH,
 *    DELETE)
 *  - `options.path` is a string of the path portion of a url (eg. /users/dashron)
 *  - `options.query` is an object containing all of your request parameters. If GET they will be
 *    appended to the url, if POST it will be part of your request body
 *  - `options.headers` is an object containing key value pairings of all of the HTTP request
 *    headers
 *
 * @param {Object|string} options If string, it will make a GET request to that url. If an object,
 *                                you can provide many parameters. See the function description for
 *                                more.
 */
context.request = function (options) {
  if (typeof options === 'string') {
    options = {path: options}
  }

  lib.request(options, function (err, data, status, headers) {
    if (err) {
      console.log('---request error---')
      console.log('status')
      console.log(status)
      console.log('headers')
      console.log(headers)

      console.log('error')
      console.log(utilModule.inspect(err))
    } else {
      console.log('---request success---')
      console.log('status')
      console.log(status)
      console.log('headers')
      console.log(headers)

      console.log('response')
      console.log(data)
    }
  })
}
