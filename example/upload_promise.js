'use strict'

/**
 *   Copyright 2023 Vimeo
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

const Vimeo = require('../index').Vimeo

let config = {}

try {
  config = require('./config.json')
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
const client = new Vimeo(config.client_id, config.client_secret, config.access_token)

// Create a variable with a hard coded path to your file system
const filePath = 'path'

const uploadVideo = async (filePath) => {
  console.log('Uploading: ' + filePath)

  const params = {
    name: 'Vimeo API SDK test upload',
    description: "This video was uploaded through the Vimeo API's NodeJS SDK."
  }

  const progressCallback = (bytesUploaded, bytesTotal) => {
    const percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
    console.log(bytesUploaded, bytesTotal, percentage + '%')
  }

  const uri = await client.upload(
    filePath,
    params,
    progressCallback
  ).catch(e => console.log(e))

  // Get the metadata response from the upload and log out the Vimeo.com url
  const metadata = await client.request(uri + '?fields=link').catch(e => console.log(e))

  console.log('The file has been uploaded to ' + metadata.link)

  // Make an API call to edit the title and description of the video.
  const editRes = await client.request({
    method: 'PATCH',
    path: uri,
    params: {
      name: 'Vimeo API SDK test edit',
      description: "This video was edited through the Vimeo API's NodeJS SDK."
    }
  }).catch(e => console.log(e))

  console.log(editRes.statusCode)
  console.log('The title and description for ' + uri + ' has been edited')

  // Make an API call to see if the video is finished transcoding.
  const transcodeStatus = await client.request(uri + '?fields=transcode.status').catch(e => console.log(e))
  console.log('The transcode status for ' + uri + ' is: ' + transcodeStatus.body.transcode.status)
}

uploadVideo(filePath)
