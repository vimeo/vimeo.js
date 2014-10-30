# Get started with the Vimeo API

There is a lot of information about the Vimeo API at https://developer.vimeo.com/api/start. Most of your questions will be answered there!

# Direct Help

 * [Stack Overflow](http://stackoverflow.com/questions/tagged/vimeo-api)
 * [Google Group](https://groups.google.com/forum/#!forum/vimeo-api)
 * [Vimeo Support](https://vimeo.com/help/contact)

# Installation

    npm install vimeo-api


# Creating your Vimeo library

All API requests, and examples in this file must create a Vimeo object. Your ```CLIENT_ID``` and ```CLIENT_SECRET``` can be found on your app page under the OAuth 2 tab. If you have not yet created an API App with vimeo, you can create one at https://developer.vimeo.com/api/apps.

You can optionally provide an ACCESS_TOKEN to the constructor. This parameter is optional, and provided as a convenience. Access tokens are only required to [make requests](#make-requests), and can be set later through the `access_token` property.

Access tokens can be generated on your Vimeo app page, or [through the API](#generate-your-access-token).

```JavaScript
    var Vimeo = require('vimeo-api').Vimeo;
    var lib = new Vimeo(CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN);
```


# Generate your Access token

All requests require access tokens. There are two types of access tokens.
 - [Unauthenticated](#unauthenticated) - Access tokens without a user. These tokens can only view public data
 - [Authenticated](#authenticated) - Access tokens with a user. These tokens interact on behalf of the authenticated user.

### Unauthenticated

Unauthenticated API requests must generate an access token. You should not generate a new access token for each request, you should request an access token once and use it forever.

```JavaScript
    // scope is an array of permissions your token needs to access. You can read more at https://developer.vimeo.com/api/authentication#scopes
    lib.generateClientCredentials(scope, function (err, access_token) {
        if (err) {
                throw err;
        }

        var token = access_token.access_token;
        
        // Other useful information is included alongside the access token
        // We include the final scopes granted to the token. This is important because the user (or api) might revoke scopes during the authentication process
        var scopes = access_token.scope;
    });
```


### Authenticated


1. Build a link to Vimeo so your users can authorize your app

```JavaScript
        var url = lib.buildAuthorizationEndpoint(redirect_uri, scopes, state)
```

Name         | Type     | Description
-------------|----------|------------
redirect_uri | string   | The uri the user is redirected to in step 3. This value must be provided to every step of the authorization process including creating your app, building your authorization endpoint and exchanging your authorization code for an access token
scope        | array    | An array of permissions your token needs to access. You can read more at https://developer.vimeo.com/api/authentication#scopes
state        | string   | A value unique to this authorization request. You should generate it randomly, and validate it in step 3.
        
        
2. Your user will need to access the authorization endpoint (either by cliking the link or through a redirect). On the authorization endpoint the user will have the option to deny your app any scopes you have requested. If they deny your app, they will be redirected back to your redirect_url with an ````error```` parameter.

3. If the user accepts your app, they will be redirected back to your redirect\_uri with a ````code```` and ````state```` query parameter (eg. http://yourredirect.com?code=abc&state=xyz). 
    1. You must validate that the ```status``` matches your status from step 1. 
    2. If the status is valid, you can exchange your code and redirect\_uri for an access token.

```JavaScript
        // redirect_uri must be provided, and must match your configured uri
        lib.accessToken(code, redirect_uri, function (err, token) {
            if (err) {
                    return response.end("error\n" + err);
            }
        
            if (token.access_token) {
                    // At this state the code has been successfully exchanged for an access token
                    lib.access_token = token.access_token;
    
                    // Other useful information is included alongside the access token
                    // We include the final scopes granted to the token. This is important because the user (or api) might revoke scopes during the authentication process
                    var scopes = token.scope;
                    
                    // We also include the full user response of the newly authenticated user. 
                    var user = access_token.user;
            }
        });
```

# Make requests

The API library has a ````request```` method which takes two parameters

### Options
This object contains your request information in key value pairs

Name        | Type     | Description
------------|----------|------------
 method     | string   | The HTTP method (e.g.: GET)
 path       | string   | The URL path (e.g.: /users/dashron)
 query      | string   | An object containing all of your parameters (e.g.: { "per_page": 5, "filter" : "featured"} )
 headers    | object   | An object containing all additional headers (e.g.: { "If-Modified-Since" : "Mon, 03 Mar 2014 16:29:37 -0500" }


### Callback
This function will be called once the upload process is complete

Name        | Type     | Description
------------|----------|------------
error       | error    | If this is provided, it means the request failed. The other parameters may, or may not contain additional information. You should check the status code to understand exactly what error you have encountered.
body        | object   | The parsed request body. All responses are JSON so we parse this for you, and give you the result.
status_code | number   | The HTTP status code of the response. This partially informs you about the success of your API request.
headers     | object   | An object containing all of the response headers.



    	lib.request(/*options*/{
            // This is the path for the videos contained within the staff picks channels
            path : '/channels/staffpicks/videos',
            // This adds the parameters to request page two, and 10 items per page
            query : {
                page : 2,
                per_page : 10
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


# Upload Videos
The API library has a ````streamingUpload```` method which takes three parameters.

Name      | Type     | Description
----------|----------|------------
file      | string   | Full path to the upload file on the local system
video_uri | string   | (Optional) Uri of an existing video. If provided, the uploaded video will replace the source file of this video.
callback  | function | A callback that will be executed when the upload is comple, or has failed. It will match the callback of an [API request](#callback).

**Upload**

    lib.streamingUpload('/home/aaron/Downloads/ada.mp4',  function (error, body, status_code, headers) {
        if (error) {
            return throw error;
        }
        
        lib.request(headers.location, function (error, body, status_code, headers) {
            console.log(body);
        });
    });

**Replace**

    lib.streamingUpload('/home/aaron/Downloads/ada.mp4', '/videos/12345',  function (error, body, status_code, headers) {
        if (error) {
            return throw error;
        }
        
        lib.request(headers.location, function (error, body, status_code, headers) {
            console.log(body);
        });
    });

# Contributors

- [Dashron](https://github.com/dashron)
- [greedo](https://github.com/greedo)
- [AidenMontgomery](https://github.com/AidenMontgomery) [[ced26262d710abe462ecc8a8a9ea97aff825e026](https://github.com/vimeo/vimeo.js/commit/ced26262d710abe462ecc8a8a9ea97aff825e026)]
