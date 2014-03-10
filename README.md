vimeo.js
========

## Get started with the Vimeo API

There is a lot of information about the Vimeo API at https://developer.vimeo.com/api/start. Most of your questions will be answered there!

## Direct Help

 * [Stack Overflow](http://stackoverflow.com/questions/tagged/vimeo-api)
 * [Google Group](https://groups.google.com/forum/#!forum/vimeo-api)
 * [Vimeo Support](https://vimeo.com/help/contact)

## Installation

    npm install vimeo-api


## Creating your Vimeo library

    var Vimeo = require('vimeo-api').Vimeo;
    // Your client_id and client_secret can be found on your app page under OAuth 2.
    // If you do not have an api app, you can create one at https://developer.vimeo.com/api/apps
    var lib = new Vimeo(CLIENT_ID, CLIENT_SECRET);
    
This library is used throughout the rest of the code. You should not create a new API library every time you make an api request, if possible you should make one api library per user. So if you only make unauthenticated requests you can always use the same API library, but if you switch between multiple Vimeo access tokens you should use a new Vimeo library for each access token.


## Generate your Access token

### Unauthenticated

Unauthenticated api requests must request an access token. You should not request a new access token for each request, you should request an access token once and use it every time.

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


### Authenticated


1. Build a link to Vimeo so your users can authorize your app

        // redirect_uri is the uri the user is redirected to in step 3. This value must be provided to every step of the authorization process including creating your app, building your authorization endpoint and exchanging your authorization code for an access token
        // scope is an array of permissions your token needs to access. You can read more at https://developer.vimeo.com/api/authentication#scopes
        // state is a value unique to this authorization request. You should generate it randomly, and validate it in step 3.
        var url = lib.buildAuthorizationEndpoint(redirect_uri, scopes, state)

2. Your user will need to access the authorization endpoint (either by cliking the link or through a redirect). On the authorization endpoint the user will have the option to deny your app any scopes you have requested. If they deny your app, they will be redirected back to your redirect_url with an ````error```` parameter.

3. If the user accepts your app, they will be redirected back to your redirect_uri with a ````code```` parameter and a ````state```` parameter. You *must* ensure that the state parameter provided is identical to your original state parameter. If the state is valid, you can exchange the code for an access token.

        // code is accessed through the query component of the url. eg http://redirect.uri/callback?code=xyz
        // redirect_uri is the exact same redirect uri you used when creating your app, and building your authorization endpoint
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


## Make requests

The API library has a ````request```` method which takes two parameters

### Options
This object contains your request information in key value pairs

 - method - The HTTP method (e.g.: GET)
 - path - The URL path (e.g.: /users/dashron)
 - query - An object containing all of your parameters (e.g.: { "per_page": 5, "filter" : "featured"} )
 - headers - An object containing all additional headers (e.g.: { "If-Modified-Since" : "Mon, 03 Mar 2014 16:29:37 -0500" }


### Callback
This function will be called once the upload process is complete
 - error - If this is provided, it means the request failed. The other parameters may, or may not contain additional information. You should check the status code to understand exactly what error you have encountered.
 - body - The parsed request body. All responses are JSON so we parse this for you, and give you the result.
 - status_code - The HTTP status code of the response. This partially informs you about the success of your API request.
 - headers - An object containing all of the response headers.


    	lib.request(/*options*/{
            // This is the path for the videos contained within the staff picks channels
            path : '/channels/staffpicks/videos',
            // This adds the parameters to request page two, and 10 items per page
            params : {
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
