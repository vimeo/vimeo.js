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

if (!config.access_token) {
  throw new Error('You can not upload a video without configuring an access token.')
}

// Instantiate the library with your client id, secret and access token (pulled from dev site)
var client = new Vimeo(config.client_id, config.client_secret, config.access_token)

// Create a variable with a hard coded path to your file system
var filePath = '<full path to a video on the filesystem>'

console.log('Uploading: ' + filePath)

var params = {
  'name': 'Vimeo API SDK test upload',
  'description': "This video was uploaded through the Vimeo API's NodeJS SDK."
}

client.upload(
  filePath,
  params,
  function (uri) {
    // Get the metadata response from the upload and log out the Vimeo.com url
    client.request(uri + '?fields=link', function (error, body, statusCode, headers) {
      if (error) {
        console.log('There was an error making the request.')
        console.log('Server reported: ' + error)
        return
      }

      console.log('"' + filePath + '" has been uploaded to ' + body.link)

      // Make an API call to edit the title and description of the video.
      client.request({
        method: 'PATCH',
        path: uri,
        params: {
          'name': 'Vimeo API SDK test edit',
          'description': "This video was edited through the Vimeo API's NodeJS SDK."
        }
      }, function (error, body, statusCode, headers) {
        if (error) {
          console.log('There was an error making the request.')
          console.log('Server reported: ' + error)
          return
        }

        console.log('The title and description for ' + uri + ' has been edited.')

        // Make an API call to see if the video is finished transcoding.
        client.request(
          uri + '?fields=transcode.status',
          function (error, body, statusCode, headers) {
            if (error) {
              console.log('There was an error making the request.')
              console.log('Server reported: ' + error)
              return
            }

            console.log('The transcode status for ' + uri + ' is: ' + body.transcode.status)
          }
        )
      })
    })
  },
  function (bytesUploaded, bytesTotal) {
    var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
    console.log(bytesUploaded, bytesTotal, percentage + '%')
  },
  function (error) {
    console.log('Failed because: ' + error)
  }
)
