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
var util = require('util')

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

// Here we have to build the vimeo library using the `client_id`, `client_secret` and an
// `access_token`.
//
// For the request we make below (/channels) the access token can be a client access token instead
// of a user access token.
var lib = new Vimeo(config.client_id, config.client_secret)

if (config.access_token) {
  lib.setAccessToken(config.access_token)
  makeRequest(lib)
} else {
  // Unauthenticated API requests must request an access token. You should not request a new access
  // token for each request, you should request an access token once and use it over and over.
  lib.generateClientCredentials('public', function (err, response) {
    if (err) {
      throw err
    }

    // Assign the access token to the library.
    lib.setAccessToken(response.access_token)
    makeRequest(lib)
  })
}

function makeRequest (lib) {
  // Make an API request
  lib.request({
    // This is the path for the videos contained within the staff picks channels
    path: '/channels/staffpicks',
    query: {
      per_page: 1
    }
  }, function (error, body, statusCode, headers) {
    if (error) {
      console.log('error')
      console.log(error)
    } else {
      console.log('body')
      console.log(util.inspect(body, false, null))
    }

    console.log('status code')
    console.log(statusCode)
    console.log('headers')
    console.log(headers)
  })
}
