'use strict'

/**
 *   Copyright 2014 Vimeo
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

function makeRequest (lib) {
  // Make an API request
  lib.request({
    // This returns the first page of videos containing the term "vimeo staff".
    // These videos will be sorted by most relevant to least relevant.
    path: '/videos',
    query: {
      page: 1,
      per_page: 10,
      query: 'vimeo staff',
      sort: 'relevant',
      direction: 'asc'
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

var lib = new Vimeo(config.client_id, config.client_secret)

if (config.access_token) {
  lib.setAccessToken(config.access_token)
  makeRequest(lib)
} else {
  // Unauthenticated API requests must request an access token. You should not request a new access token for each
  // request, you should request an access token once and use it over and over.
  lib.generateClientCredentials('public', function (err, response) {
    if (err) {
      throw err
    }

    // Assign the access token to the library
    lib.setAccessToken(response.access_token)
    makeRequest(lib)
  })
}
