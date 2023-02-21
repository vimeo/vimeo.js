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

const fs = require('fs')
const Vimeo = require('../index').Vimeo
let config

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
const lib = new Vimeo(config.client_id, config.client_secret, config.access_token)

// Documentation: https://developer.vimeo.com/api/upload/texttracks

const getUploadLink = async (path, token, type = 'captions', language = 'en', name = '') => {
  const res = await lib.request(
    {
      hostname: 'api.vimeo.com',
      path,
      headers: {
        Authorization: 'bearer ' + token,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      query: {
        type,
        language,
        name
      }
    }).catch(e => console.log(e))
  console.log(res)
  return res
}

const uploadTextTrack = async (textTrackUrl, token, filePath) => {
  const vttSubs = fs.readFileSync(
    filePath,
    'utf-8'
  )

  const res = await lib.request(
    {
      hostname: 'captions.cloud.vimeo.com',
      path: textTrackUrl.replace('https://captions.cloud.vimeo.com/', ''),
      headers: {
        Authorization: 'bearer ' + token,
        'Content-Type': 'text/plain' // important!
      },
      method: 'PUT',
      body: vttSubs
    }
  ).catch(e => console.log(e))

  return res
}

const uploadTextTrackCycle = async () => {
  const token = config.access_token
  const textTrackUri = '/videos/[video id]/texttracks'
  const vttPath = 'path'

  const uploadLink = await getUploadLink(textTrackUri, token)
  console.log(uploadLink.body.link)

  const res = await uploadTextTrack(uploadLink.body.link, token, vttPath)
  console.log(res.statusCode)
}

uploadTextTrackCycle()
