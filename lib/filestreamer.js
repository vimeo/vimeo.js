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

var urlModule = require('url')
var fsModule = require('fs')
var httpsModule = require('https')
var httpModule = require('http')

/**
 * This object facilitates resumable uploading
 *
 * @param {string}    filePath         Path to the video file.
 * @param {string}    uploadEndpoint   Upload URL provided with an upload attempt.
 * @param {Function}  progressCallback
 */
var FileStreamer = module.exports = function FileStreamer (filePath, uploadEndpoint, progressCallback) {
  if (!filePath) {
    throw new Error('You must provide a file path.')
  }

  if (!uploadEndpoint) {
    throw new Error('You must provide an upload endpoint.')
  }

  this._endpoint = urlModule.parse(uploadEndpoint)
  this._path = filePath
  this.progress_callback = progressCallback
}

FileStreamer.prototype._endpoint = null
FileStreamer.prototype._path = null
FileStreamer.prototype._fd = null
FileStreamer.prototype._file_size = 0
FileStreamer.prototype.percentage = 0
FileStreamer.prototype.sequential = true
FileStreamer.prototype.progress_callback = null

/**
 * Holds the user defined ready function.
 *
 * Do not call this outside of the library.
 */
FileStreamer.prototype._user_ready = function () {
  this.ready = function (fn) {
    fn()
  }
}

/**
 * Called internally whenever the upload might be complete.
 *
 * If the upload is complete it will call `_user_ready`, if not it will attempt to upload from where it left off.
 *
 * Do not call this outside of the library.
 */
FileStreamer.prototype._ready = function () {
  var _self = this

  // If we think we are ready to complete, check with the server and see if they have the whole file
  this._getNewStart(function (err, start) {
    if (err) {
      // If the check fails, close the file and error out immediately
      _self._closeFile()
      return _self._error(err)
    }

    if (start >= _self._file_size) {
      // If the server says they have the whole file, close it and then return back to the user
      _self._closeFile()
      _self._user_ready()
    } else {
      // If the server does not have the whole file, upload from where we left off
      _self._streamChunk(start)
    }
  })
}

/**
 * Assign a callback to be called whenever the file is done uploading.
 *
 * @param {Function} fn The ready callback
 */
FileStreamer.prototype.ready = function (fn) {
  this._user_ready = fn
}

/**
 * Holds the error callback. Do not call this outside of the library
 *
 * @param {Error} error The error that was thrown.
 */
FileStreamer.prototype._error = function (error) {
  this.error = function (fn) {
    fn(error)
  }
}

/**
 * Assign a callback to be called whenever an error occurs.
 *
 * @param {Function} fn The error callback
 */
FileStreamer.prototype.error = function (fn) {
  this._error = fn
}

/**
 * Start uploading the file.
 *
 */
FileStreamer.prototype.upload = function () {
  var _self = this

  fsModule.stat(_self._path, function (statErr, stats) {
    if (statErr) {
      return _self._error(statErr)
    }

    _self._file_size = stats.size

    fsModule.open(_self._path, 'r', function (openErr, fd) {
      if (openErr) {
        return this._error(openErr)
      }

      _self._fd = fd
      _self._streamChunk(0)
    })
  })
}

/**
 * Send a file chunk, starting at byte [start] and ending at the end of the file.
 *
 * @param {number} start
 */
FileStreamer.prototype._streamChunk = function (start) {
  var _self = this
  _self._putFile(start, function (err, code, headers) {
    // Catches a rare Vimeo server bug and exits out early.
    if (err && code) {
      _self._closeFile()
      return _self._error(err)
    }

    _self._ready()
  })
}

/**
 * Make the HTTP put request sending a part of a file up to the upload server
 *
 * @param {number}   start    The first byte of the file
 * @param {Function} callback A function which is called once the upload is complete, or has failed.
 */
FileStreamer.prototype._putFile = function (start, callback) {
  var _self = this

  var file = fsModule.createReadStream(_self._path, {
    start: start
  })

  file.on('error', function (err) {
    callback(err)
  })

  var uploadedSize = start || 0

  file.on('data', function (chunk) {
    uploadedSize += chunk.length || 0
    if (_self.progress_callback) {
      _self.progress_callback(uploadedSize, _self._file_size)
    }
  })

  var headers = {
    'Content-Length': _self._file_size,
    'Content-Type': 'video/mp4'
  }

  headers['Content-Range'] = 'bytes ' + start + '-' + _self._file_size + '/' + _self._file_size

  var req = _self._upload_endpoint_request({
    method: 'PUT',
    headers: headers
  }, callback)

  file.pipe(req)
}

/**
 * Close the file.
 *
 */
FileStreamer.prototype._closeFile = function () {
  if (this._fd) {
    fsModule.close(this._fd, function (err) {
      if (err) {
        this._error(err)
      }
    })

    this._fd = null
  }
}

/**
 * Verify the file upload and determine the last most byte the server has received.
 *
 * @param {Function} next A callback that will be called when the check is complete, or has errored.
 */
FileStreamer.prototype._getNewStart = function (next) {
  this._upload_endpoint_request({
    method: 'PUT',
    headers: {
      'Content-Range': 'bytes */*',
      'Content-Type': 'application/octet-stream'
    }
  }, function (err, status, headers) {
    if (err) {
      return next(err)
    }

    if (status === 308) {
      return next(null, parseInt(headers.range.split('-')[1]))
    } else {
      return next(new Error('Invalid http status returned from range query: [' + status + ']'))
    }
  }).end()
}

/**
 * Makes an HTTP request to the upload server, and sends the response through the callback.
 *
 * @param  {Object}   options  Request options, fed into `https.request(options)`
 * @param  {Function} callback Called when the upload is complete, or has failed.
 */
FileStreamer.prototype._upload_endpoint_request = function (options, callback) {
  var requestOptions = {
    protocol: this._endpoint.protocol,
    host: this._endpoint.hostname,
    port: this._endpoint.port,
    query: this._endpoint.query,
    headers: options.headers,
    path: this._endpoint.path,
    method: options.method
  }

  var client = requestOptions.protocol === 'https:' ? httpsModule : httpModule
  var req = client.request(requestOptions)

  req.on('response', function (res) {
    res.setEncoding('utf8')

    var buffer = ''
    res.on('readable', function () {
      buffer += res.read()
    })

    if (res.statusCode > 399) {
      // failed api calls should wait for the response to end and then call the callback with an error.
      res.on('end', function () {
        callback(new Error('[' + buffer + ']'), res.statusCode, res.headers)
      })
    } else {
      // successful api calls should wait for the response to end and then call the callback with the response body
      res.on('end', function () {
        callback(null, res.statusCode, res.headers)
      })
    }
  })

  // Notify user of any weird connection/request errors.
  req.on('error', function (e) {
    callback(e)
  })

  return req
}
