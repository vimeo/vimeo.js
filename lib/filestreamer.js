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

var url_module = require('url');
var fs_module = require('fs');
var https_module = require('https');
var http_module = require('http');

/**
 * This object facilitates resumable uploading
 * 
 * @param {string} file_path       Path to the video file
 * @param {string} upload_endpoint upload URL provided with an upload ticket
 */
var FileStreamer = module.exports = function FileStreamer(file_path, upload_endpoint) {
    if (!file_path) {
        throw new Error('You must provide a file path');
    }

    if (!upload_endpoint) {
        throw new Error('You must provide an upload endpoint');
    }

    this._endpoint = url_module.parse(upload_endpoint);
    this._path = file_path;
}

FileStreamer.prototype._endpoint = null;
FileStreamer.prototype._path = null;
FileStreamer.prototype._fd = null;
FileStreamer.prototype._file_size = 0;
FileStreamer.prototype.sequential = true;

/**
 * Holds the user defined ready function. Do not call this outside of the library
 */
FileStreamer.prototype._user_ready = function () {
    this.ready = function (fn) {
        fn();
    }
};

/**
 * Called internally whenever the upload might be complete. 
 * If the upload is complete it will call _user_ready, if not it will attempt to upload from where it left off.
 *
 * Do not call this outside of the library.
 */
FileStreamer.prototype._ready = function () {
    var _self = this;

    // If we think we are ready to complete, check with the server and see if they have the whole file
    this._getNewStart(function (err, start) {
        if (err) {
            // If the check fails, error out immediately
            return _self._error(err);
        }

        if (start >= _self._file_size) {
            // If the server says they have the whole file, return back to the user
            _self._user_ready();
        } else {
            // If the server does not have the whole file, upload from where we left off
            _self._streamChunk(start);
        }
    });
};

/**
 * Assign a callback to be called whenever the file is done uploading.
 * 
 * @param  {Function} fn The ready callback
 */
FileStreamer.prototype.ready = function (fn) {
    this._user_ready = fn;
};

/**
 * Holds the error callback. Do not call this outside of the library
 * 
 * @param  {Error} error The error that was thrown
 * @return {[type]}       [description]
 */
FileStreamer.prototype._error = function (error) {
    this.error = function (fn) {
        fn(error);
    }
};

/**
 * Assign a callback to be called whenever an error occurs.
 * 
 * @param  {Function} fn The error callback
 */
FileStreamer.prototype.error = function (fn) {
    this._error = fn;
};

/**
 * Start uploading the file
 */
FileStreamer.prototype.upload = function () {
    var _self = this;

    fs_module.stat(_self._path, function (stat_err, stats) {
        if (stat_err) {
            return _self._error(stat_err);
        }

        _self._file_size = stats.size;

        fs_module.open(_self._path, 'r', function(open_err, fd) {
            if (open_err) {
                return this._error(open_err);
            }

            _self._fd = fd;
            _self._streamChunk(0);
        });
    });
};

/**
 * Send a file chunk, starting at byte [start] and ending at the end of the file
 * 
 * @param  {Number} start
 */
FileStreamer.prototype._streamChunk = function (start) {
    var _self = this;
    _self._putFile(start, function (put_err, code, headers) {

        // Catches a rare vimeo server bug and exits out early
        if (put_err && code) {
            return _self._error(put_err);
        }

        _self._ready();
    });
}

/**
 * Make the HTTP put request sending a part of a file up to the upload server
 * 
 * @param  {Number}   start    The first byte of the file
 * @param  {Function} callback A function which is called once the upload is complete, or has failed
 */
FileStreamer.prototype._putFile = function (start, callback) {
    var _self = this;

    var file = fs_module.createReadStream(_self._path, {
        start : start
    });

    file.on('error', function (err) {
        callback(err);
    });
    
    var headers =  {
        'Content-Length' : _self._file_size,
        'Content-Type' : 'video/mp4'
    };

    headers['Content-Range'] = 'bytes ' + start + '-' + _self._file_size + '/' + _self._file_size;

    var req = _self._upload_endpoint_request({
        method : 'PUT',
        headers : headers
    }, callback);

    file.pipe(req);
}

/**
 * Verify the file upload and determine the last most byte the server has received
 * @param  {Function} next A callback that will be called when the check is complete, or has errored
 */
FileStreamer.prototype._getNewStart = function (next) {
    var _self = this;

    this._upload_endpoint_request({
        method : 'PUT',
        headers : {
            'Content-Range' : 'bytes */*',
            'Content-Type' : 'application/octet-stream'
        }
    }, function (err, status, headers) {
        if (err) {
            return next(err);
        }

        if (status === 308) {
            return next(null, parseInt(headers.range.split('-')[1]));
        } else {
            return next(new Error('Invalid http status returned from range query: [' + status + ']'));
        }
    }).end();
};

/**
 * Makes an http request to the upload server, and sends the response through the callback
 * 
 * @param  {Object}   options  Request options, pumped into https.request(options);
 * @param  {Function} callback Called when the upload is complete, or has failed
 */
FileStreamer.prototype._upload_endpoint_request = function (options, callback) {
    var request_options = {
        protocol : this._endpoint.protocol,
        host : this._endpoint.hostname,
        port : this._endpoint.port,
        query : this._endpoint.query,
        headers : options.headers,
        path : this._endpoint.path,
        method : options.method
    };

    var client = request_options.protocol === 'https:' ? https_module : http_module;
    var req = client.request(request_options);

    req.on('response', function (res) {
        res.setEncoding('utf8');

        var buffer = '';
        res.on('readable', function () {
            buffer += res.read();
        });

        if (res.statusCode > 399) {
            // failed api calls should wait for the response to end and then call the callback with an error.
            res.on('end', function () {
                callback(new Error('[' + buffer + ']'), res.statusCode, res.headers);
            });
        } else {
            // successful api calls should wait for the response to end and then call the callback with the response body
            res.on('end', function () {
                callback(null, res.statusCode, res.headers);
            });
        }
    });

    // notify user of any weird connection/request errors
    req.on('error', function(e) {
        callback(e);
    });

    return req;
};