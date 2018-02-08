# <img src="https://user-images.githubusercontent.com/33762/33720344-abc20bb8-db31-11e7-8362-59a4985aeff0.png" width="250" />

[![npm](https://img.shields.io/npm/v/vimeo.svg?style=flat-square)](https://www.npmjs.com/package/vimeo)
[![License](https://img.shields.io/github/license/vimeo/vimeo.js.svg)](https://www.npmjs.com/package/vimeo)

This is a simple Node.js library for interacting with the [Vimeo API](https://developers.vimeo.com).

- [Get Started](#get-started-with-the-vimeo-api)
- [Help](#direct-help)
- [Troubleshooting](#troubleshooting)
- [Installation](#installation)
- [Usage](#usage)
    - [Authentication and access tokens](#generate-your-access-token)
        - [Unauthenticated](#unauthenticated)
        - [Authenticated](#authenticated)
    - [Make requests](#make-requests)
    - [Uploading videos](#uploading-videos)
        - [Replacing video files](#replacing-video-files)

## Get started with the Vimeo API

There is a lot of information about the Vimeo API at https://developer.vimeo.com/api/start. Most of your questions are answered there!

## Direct Help

 * [Stack Overflow](http://stackoverflow.com/questions/tagged/vimeo-api)
 * [Vimeo Support](https://vimeo.com/help/contact)

## Installation

    npm install vimeo

## Usage

All API requests and examples in this file must create a Vimeo object. Your `CLIENT_ID` and `CLIENT_SECRET` can be found on your app page under the Authentication tab. If you have not yet created an API app with Vimeo, you can create one at https://developer.vimeo.com/apps.

You can optionally provide an `ACCESS_TOKEN` to the constructor. Access tokens are required only to [make requests](#make-requests), and you can set them later through the `setAccessToken` method.

You can generate acces tokens on your Vimeo app page or [through the API](#generate-your-access-token).

```js
var Vimeo = require('vimeo').Vimeo;
var client = new Vimeo(CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN);
```

### Generate your access token

All requests require access tokens. There are two types of access tokens:

 - [Unauthenticated](#unauthenticated): Access tokens without a user. These tokens can view only public data.
 - [Authenticated](#authenticated): Access tokens with a user. These tokens interact on behalf of the authenticated user.

#### Unauthenticated

Unauthenticated API requests must generate an access token. You should not generate a new access token for each request. Instead, request an access token once and use it forever.

```js
// `scope` is an array of permissions your token needs to access. You
// can read more at https://developer.vimeo.com/api/authentication#supported-scopes
client.generateClientCredentials(scope, function (err, response) {
  if (err) {
    throw err;
  }

  var token = response.access_token;

  // Other useful information is included alongside the access token,
  // which you can dump out to see, or visit our API documentation.
  //
  // We include the final scopes granted to the token. This is
  // important because the user, or API, might revoke scopes during
  // the authentication process.
  var scopes = response.scope;
});
```

#### Authenticated

1. Build a link to Vimeo so your users can authorize your app.

```js
var url = client.buildAuthorizationEndpoint(redirect_uri, scopes, state)
```

Name           | Type     | Description
---------------|----------|------------
`redirect_uri` | string   | The URI the user is redirected to in Step 3. This value must be provided to every step of the authorization process, including creating your app, building your authorization endpoint, and exchanging your authorization code for an access token.
`scope`        | array    | An array of permissions your token needs to access. You can read more at https://developer.vimeo.com/api/authentication#supported-scopes.
`state`        | string   | A value unique to this authorization request. You should generate it randomly and validate it in Step 3.

2. Your user needs to access the authorization endpoint (either by clicking the link or through a redirect). On the authorization endpoint, the user has the option to deny your app any scopes you have requested. If they deny your app, they are redirected back to your `redirect_url` with an `error` parameter.

3. If the user accepts your app, they are redirected back to your `redirect_uri` with a `code` and `state` query parameter (eg. http://yourredirect.com?code=abc&state=xyz).
    1. You must validate that the `state` matches your state from Step 1.
    2. If the state is valid, you can exchange your code and `redirect_uri` for an access token.

```js
// `redirect_uri` must be provided, and must match your configured URI.
client.accessToken(code, redirect_uri, function (err, response) {
  if (err) {
    return response.end("error\n" + err);
  }

  if (response.access_token) {
    // At this state the code has been successfully exchanged for an
    // access token
    client.setAccessToken(response.access_token);

    // Other useful information is included alongside the access token,
    // which you can dump out to see, or visit our API documentation.
    //
    // We include the final scopes granted to the token. This is
    // important because the user, or API, might revoke scopes during
    // the authentication process.
    var scopes = response.scope;

    // We also include the full user response of the newly
    // authenticated user.
    var user = response.user;
  }
});
```

### Make requests
The API library has a `request` method that takes two parameters.

#### Options
This object contains your request information in key/value pairs.

Name         | Type     | Description
-------------|----------|------------
`method`     | string   | The HTTP method (e.g.: `GET`)
`path`       | string   | The URL path (e.g.: `/users/dashron`)
`query`      | string   | An object containing all of your parameters (for example, `{"per_page": 5, "filter": "featured"}`. )
`headers`    | object   | An object containing all additional headers (for example, `{"If-Modified-Since": "Mon, 03 Mar 2014 16:29:37 -0500"}`

#### Callback
This function is called once the upload process is complete.

Name          | Type     | Description
--------------|----------|------------
`error`       | error    | If this is provided, it means the request failed. The other parameters may or may not contain additional information. Check the status code to understand exactly what error you have encountered.
`body`        | object   | The parsed request body. All responses are JSON, so we parse this for you and give you the result.
`status_code` | number   | The HTTP status code of the response. This partially informs you about the success of your API request.
`headers`     | object   | An object containing all of the response headers.

```js
client.request(/*options*/{
  // This is the path for the videos contained within the staff picks
  // channels
  path: '/channels/staffpicks/videos',
  // This adds the parameters to request page two, and 10 items per
  // page
  query: {
    page: 2,
    per_page: 10,
    fields: 'uri,name,description,duration,created_time,modified_time'
  }
}, /*callback*/function (error, body, status_code, headers) {
  if (error) {
    console.log('error');
    console.log(error);
  } else {
    console.log('body');
    console.log(body);
  }

  console.log('status code');
  console.log(status_code);
  console.log('headers');
  console.log(headers);
});
```

#### Rate limiting
You should ensure to set [JSON filter](https://developer.vimeo.com/api/common-formats#json-filter) fields on *all* requests to ensure a steady and higher [`X-RateLimit-Limit`](https://developer.vimeo.com/guidelines/rate-limiting).

There is an open [issue#51](https://github.com/vimeo/vimeo.js/issues/51) to reflect that the [current documentation](https://developer.vimeo.com/api/start#identify-action) states that POST, PUT, DELETE, and PATCH requests must provide parameters in the body, but this doesn't work with the JSON filter request. Here is an example of a properly formed DELETE request:

```js
client.request(/*options*/{
  method: 'DELETE',
  path: '/channels/12345?fields=uri'
}, /*callback*/function (error, body, status_code, headers) {
  if (error) {
    console.log('error');
    console.log(error);
  } else {
    console.log('body');
    console.log(body);
  }

  console.log('status code');
  console.log(status_code);
  console.log('headers');
  console.log(headers);
});
```

### Uploading videos
The API library has an `upload` method that takes five parameters.

Internally, this library executes a `tus` upload approach and sends a file to the server with the [tus](https://tus.io/) upload protocol and [tus-js-client](https://www.npmjs.com/package/tus-js-client).

Name               | Type              | Description
-------------------|-------------------|------------
`path`             | string            | Full path to the upload file on the local system.
`params`           | object (optional) | Parameters to send when creating a new video (name, privacy restrictions, and so on). See the [`/me/videos` documentation](https://developer.vimeo.com/api/endpoints/videos#POST/users/{user_id}/videos) for supported parameters.
`completeCallback` | function          | A callback that is executed when the upload is complete. It has one argument, `uri`, that is the `/videos/:id` URI for your uploaded video.
`progressCallback` | function          | A callback that is executed periodically during file uploading. This callback receives two parameters, `bytesUploaded` and `bytesTotal`. You can use this to determine how much of a percentage has been uploaded to the Vimeo servers.
`errorCallback`    | function          | A callback that is executed when any errors happen during the upload process. It has one argument, `err`, that is a string error message.

```js
client.upload(
  '/home/aaron/Downloads/ada.mp4',
  function (uri) {
    console.log('File upload completed. Your Vimeo URI is:', uri)
  },
  function (bytesUploaded, bytesTotal) {
    var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
    console.log(bytesUploaded, bytesTotal, percentage + '%')
  },
  function (error) {
    console.log('Failed because: ' + error)
  }
)
```

#### Replacing video files
To replace the source file of a video, call the `replace` method. It accepts five parameters:

Name               | Type              | Description
-------------------|-------------------|------------
`path`             | string            | Full path to the upload file on the local system.
`videoUri`         | string            | Video URI of the video file to replace.
`completeCallback` | function          | A callback that is executed when the upload is complete. It has one argument, `uri`, that is the `/videos/:id` URI for your uploaded video.
`progressCallback` | function          | A callback that is executed periodically during file uploading. This callback receives two parameters, `bytesUploaded` and `bytesTotal`. You can use this to determine how much of a percentage has been uploaded to the Vimeo servers.
`errorCallback`    | function          | A callback that is executed when any errors happen during the upload process. It has one argument, `err`, that will be a string error message.

```js
client.upload(
  '/home/aaron/Downloads/ada-v2.mp4',
  '/videos/15'
  function (uri) {
    console.log('File upload completed. Your Vimeo URI is:', uri)
  },
  function (bytesUploaded, bytesTotal) {
    var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
    console.log(bytesUploaded, bytesTotal, percentage + '%')
  },
  function (error) {
    console.log('Failed because: ' + error)
  }
)
```

## Troubleshooting

If you have any questions or problems, create a [ticket](https://github.com/vimeo/vimeo.js/issues) or [contact us](https://vimeo.com/help/contact).

## Contributors

To see the contributors, please visit the [contributors graph](https://github.com/vimeo/vimeo.js/graphs/contributors).
