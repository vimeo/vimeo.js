"use strict";

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
var qs_module = require('querystring');
var url_module = require('url');
var crypto_module = require('crypto');
var http_module = require('http');
var https_module = require('https');
var FileStreamer = require('./filestreamer');

module.exports.request_defaults = {
	protocol : 'https:',
	hostname : 'api.vimeo.com',
	port : 443,
	method : 'GET',
	query : {},
	headers : {
		Accept: "application/vnd.vimeo.*+json;version=3.2",
		'User-Agent': 'Vimeo.js/1.1.1'
	}
};

var auth_endpoints = module.exports.auth_endpoints = {
	authorization : '/oauth/authorize',
	accessToken : '/oauth/access_token',
	clientCredentials : '/oauth/authorize/client'
};

/**
 * This object is used to interface with the vimeo api
 * 
 * @param {string} client_id     OAuth 2 Client Identifier
 * @param {string} client_secret OAuth 2 Client Secret
 * @param (string) access_token  OAuth 2 Optional pre-authorized access token
 */
var Vimeo = module.exports.Vimeo = function Vimeo (client_id, client_secret, access_token) {
	this._client_id = client_id;
	this._client_secret = client_secret;

	if (access_token) {
		this.access_token = access_token;
	}
};

Vimeo.prototype._client_id = null;
Vimeo.prototype._client_secret = null;
Vimeo.prototype.access_token = null;

/**
 * Performs an api call.
 * Can be called one of two ways.
 * 1. Url + Callback
 *     If a url is provided, we fill in the rest of the request options with defaults (GET http://api.vimeo.com/{url}).
 *
 * 2. Options + callback
 *     If an object is provided, it should match the response of url_module.parse. Path is the only required parameter.
 *
 *     hostname
 *     port
 *     query (will be applied to the url if GET, request body if POST)
 *     headers
 *     path (can include a querystring)
 *     method
 *
 * The callback takes two parameters, err and json.
 * If an error has occured, your callback will be called as callback(err);
 * If an error has not occured, your callback will be called as callback(null, json);
 *
 * @param {String|Object} options string path (default GET), or object with path, host, port, query, headers
 * @param {Function} callback called when complete, function (err, json)
 */
Vimeo.prototype.request = function vimeo_request (options, callback) {
	var client = null;

	// if a url was provided, build an options object
	if (typeof options === "string") {
		options = url_module.parse(options, true);
		options.method = "GET";
	}

	// if we don't have a path at this point, error. a path is the only required field. we have defaults for everything else important
	if (typeof options.path !== "string") {
		return callback(new Error('You must provide an api path'));
	}

	// Turn the provided options into options that are valid for client.request
	var request_options = this._buildRequestOptions(options);

	// Locate the proper client from the request protocol
	client = request_options.protocol === 'https:' ? https_module : http_module;

	// Perform the vimeo api request
	var req = client.request(request_options, this._handleRequest(callback));

	// Write the request body
	if (['POST','PATCH','PUT','DELETE'].indexOf(request_options.method) !== -1) {
		if (request_options.headers['Content-Type'] === 'application/json') {
			request_options.body = JSON.stringify(options.query);
		} else {
			request_options.body = qs_module.stringify(options.query);
		}

		if (request_options.body) {
			req.write(request_options.body);
		}
	}

	// notify user of any weird connection/request errors
	req.on('error', function(e) {
		callback(e);
	});

	// send the request
	req.end();
};

/**
 * Creates the standard request handler for http requests
 * 
 * @param  {Function} callback
 * @return {Function}
 */
Vimeo.prototype._handleRequest = function (callback) {
	return function (res) {
		res.setEncoding('utf8');

		var buffer = '';

		res.on('readable', function () {
			buffer += res.read() || '';
		});

		if (res.statusCode >= 400) {
			// failed api calls should wait for the response to end and then call the callback with an error.
			res.on('end', function () {
				var err = new Error(buffer);
				callback(err, buffer, res.statusCode, res.headers);
			});
		} else {
			// successful api calls should wait for the response to end and then call the callback with the response body
			res.on('end', function () {
				try {
					var body = buffer.length ? JSON.parse(buffer) : {};
				} catch (e) {
					return callback(buffer, buffer, res.statusCode, res.headers);
				}
				callback(null, body, res.statusCode, res.headers);
			});
		}
	};
};

/**
 * Merge the request options defaults into the request options
 * 
 * @param  {Object} options
 * @return {Object}
 */
Vimeo.prototype._buildRequestOptions = function (options) {
	// set up the request object. we always use the options paramter first, and if no value is provided we fall back to request defaults
	var request_options = this._applyDefaultRequestOptions(options);

	// Apply the access tokens
	if (this.access_token) {
		request_options.headers.Authorization = 'Bearer ' + this.access_token;
	} else if (this._client_id && this._client_secret) {
		request_options.headers.Authorization = 'Basic ' + new Buffer(this._client_id + ':' + this._client_secret).toString('base64');
	}

	// Set proper headers for POST, PATCH and PUT bodies
	if (['POST','PATCH','PUT','DELETE'].indexOf(request_options.method) !== -1 && !request_options.headers['Content-Type']) {
		request_options.headers['Content-Type'] = 'application/json';

	// Apply parameters to the url for GET requests
	} else if (request_options.method === 'GET') {
		request_options.path = this._applyQuerystringParams(request_options, options);
	}

	return request_options;
}

/**
 * Create an object of request options based on the provided list of options, and the request defaults.
 * 
 * @param  {Object} options
 * @return {Object}
 */
Vimeo.prototype._applyDefaultRequestOptions = function (options) {
	var request_options = {
		protocol : options.protocol || module.exports.request_defaults.protocol,
		host : options.hostname || module.exports.request_defaults.hostname,
		port : options.port || module.exports.request_defaults.port,
		method : options.method || module.exports.request_defaults.method,
		headers : options.headers || {},
		body : '',
		path : options.path
	};
	var key = null;

	// Apply the default headers
	if (module.exports.request_defaults.headers) {
		for (key in module.exports.request_defaults.headers) {
			if (!request_options.headers[key]) {
				request_options.headers[key] = module.exports.request_defaults.headers[key];
			}
		}
	}

	return request_options;
}

/**
 * Apply the query parameter onto the final request url
 * 
 * @param  {Object} request_options
 * @param  {Object} options
 * @return {String}
 */
Vimeo.prototype._applyQuerystringParams = function (request_options, options) {
	var querystring = '';

	if (!options.query) {
		return request_options.path;
	}

	// If we have parameters, apply them to the url
	if (Object.keys(options.query).length) {
		if (request_options.path.indexOf('?') < 0) {
			// If the existing path does not contain any parameters, apply them as the only options
			querystring = '?' + qs_module.stringify(options.query);
		} else {
			// If the user already added parameters to the url, we want to add them as additional parameters
			querystring = '&' + qs_module.stringify(options.query);
		}
	}

	return request_options.path + querystring;
}


/**
 * Exchange a code for an access token. This code should exist on your redirect_uri
 * 
 * @param  {String} code the code provided on your redirect_uri
 * @param  {String} redirect_uri the exact redirect_uri provided to buildAuthorizationEndpoint and configured in your api app settings
 * @return {null}
 */
Vimeo.prototype.accessToken = function (code, redirect_uri, fn) {
	var _self = this;

	this.request({
		method : 'POST',
		hostname : module.exports.request_defaults.hostname,
		path : auth_endpoints.accessToken,
		query : {
			grant_type : 'authorization_code',
			code : code,
			redirect_uri : redirect_uri
		},
		headers : {
			'Content-Type' : 'application/x-www-form-urlencoded'
		}
	}, function (err, body, status, headers) {
		if (err) {
			return fn(err, null, status, headers);
		} else {
			fn(null, body, status, headers);
		}
	});
};


/**
 * The first step of the authorization process.
 *
 * This function returns a url, which the user should be sent to (via redirect or link).
 * The destination allows the user to accept or deny connecting with vimeo, and accept or deny each of the scopes you requested.
 * Scopes are passed through the second parameter as an array of strings, or a space delimited list.
 *
 * Once accepted or denied, the user is redirected back to the redirect_uri.
 * If accepted, the redirect url will
 *
 * @param  {String} redirect_uri The uri that will exchange a code for an access token. Must match the uri in your app settings.
 * @param  {String} scope        An array of scopes. see https://developer.vimeo.com/api/authentication#scopes for more
 * @param  {String} state        A random state that will be returned to you on your redirect uri.
 */
Vimeo.prototype.buildAuthorizationEndpoint = function (redirect_uri, scope, state) {
	var query = {
		response_type : 'code',
		client_id : this._client_id,
		redirect_uri : redirect_uri
	};

	if (scope) {
		if (Array.isArray(scope)) {
			query.scope = scope.join(' ');
		} else {
			query.scope = scope;
		}
	} else {
		query.scope = 'public';
	}

	if (state) {
		query.state = state;
	}

	return module.exports.request_defaults.protocol + '//' + module.exports.request_defaults.hostname + auth_endpoints.authorization + '?' + qs_module.stringify(query);
};

/**
 * Generates an unauthenticated access token. This is necessary to make unauthenticated requests
 * 
 * @param  {string}   scope An array of scopes. see https://developer.vimeo.com/api/authentication#scopes for more
 * @param  {Function} fn    A function that is called when the request is complete. If an error occured the first parameter will be that error, otherwise the first parameter will be null.
 */
Vimeo.prototype.generateClientCredentials = function (scope, fn) {
	var query =  {
		grant_type : 'client_credentials',
	}

	if (scope) {
		if (Array.isArray(scope)) {
			query.scope = scope.join(' ');
		} else {
			query.scope = scope;
		}
	} else {
		query.scope = 'public';
	}

	this.request({
		method : 'POST',
		hostname : module.exports.request_defaults.hostname,
		path : auth_endpoints.clientCredentials,
		query : query,
		headers : {
			'Content-Type' : 'application/x-www-form-urlencoded'
		}
	}, function (err, body, status, headers) {
		if (err) {
			return fn(err, null, status, headers);
		} else {
			fn(null, body, status, headers);
		}
	});
}

/**
 * Initiate streaming uploads
 * 
 * @param  {string}   path      The path to the file you wish to upload
 * @param  {Function} callback  A function that is called when the upload is complete, or fails. 
 */
Vimeo.prototype.streamingUpload = function (path, video_uri, callback) {
    var _self = this;

    if (!callback) {
        callback = video_uri;
        video_uri = undefined;
    }

    var options = {
        method : video_uri ? 'PUT' : 'POST',
        path : video_uri ? video_uri + '/files' : '/me/videos',
        query : {
            type : 'streaming'
        }
    };

    this.request(options, function (err, ticket, status, headers) {
        if (err) {
            return callback(err);
        }

        var file = new FileStreamer(path, ticket.upload_link_secure);

        file.ready(function () {
            _self.request({
                method : 'DELETE',
                path : ticket.complete_uri
            }, callback);
        });

        file.error(callback);
        file.upload();
    });
};
