/* eslint-env mocha */
'use strict'

const Vimeo = require('../../lib/vimeo').Vimeo
const requestDefaults = require('../../lib/vimeo').request_defaults
const authEndpoints = require('../../lib/vimeo').authEndpoints
const http = require('http') // Needed for mocking
const https = require('https') // Needed for mocking
const fs = require('fs') // Needed for mocking
const events = require('events')

const expect = require('chai').expect
const sinon = require('sinon')

describe('Vimeo.buildAuthorizationEndpoint', () => {
  const REDIRECT_URL = 'https://myapp.com/login'
  const vimeo = new Vimeo('id', 'secret', 'token')

  it('uses `public` scope by default', () => {
    const url = vimeo.buildAuthorizationEndpoint(REDIRECT_URL)
    expect(url).to.contain('scope=public')
  })

  it('uses a space-separated list for scopes', () => {
    const url = vimeo.buildAuthorizationEndpoint(REDIRECT_URL, ['scope1', 'scope2'])
    expect(url).to.contain('scope=scope1%20scope2')
  })

  it('uses a space-separated list for scopes', () => {
    const url = vimeo.buildAuthorizationEndpoint(REDIRECT_URL, 'scope1 scope2')
    expect(url).to.contain('scope=scope1%20scope2')
  })

  it('uses state if present', () => {
    const url = vimeo.buildAuthorizationEndpoint(REDIRECT_URL, 'scope', 'state')
    expect(url).to.contain('state=state')
  })

  it('uses request_defaults to build the URL', () => {
    const url = vimeo.buildAuthorizationEndpoint(REDIRECT_URL, 'scope', 'state')
    expect(url).to.contain(requestDefaults.protocol)
    expect(url).to.contain(requestDefaults.hostname)
  })
})

describe('Vimeo.generateClientCredentials', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')

  afterEach(() => {
    sinon.restore()
  })

  describe('request is called with the expected parameters', () => {
    let mockRequest
    beforeEach(() => {
      mockRequest = sinon.fake()
      sinon.replace(vimeo, 'request', mockRequest)
    })

    it('with `public` scope by default', () => {
      vimeo.generateClientCredentials()
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match({ query: sinon.match.has('scope', 'public') }))
    })

    it('with a space-separated list for scopes', () => {
      vimeo.generateClientCredentials(['scope1', 'scope2'])
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match({ query: sinon.match.has('scope', 'scope1 scope2') }))
    })

    it('with a space-separated list for scopes', () => {
      vimeo.generateClientCredentials('scope1 scope2')
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match({ query: sinon.match.has('scope', 'scope1 scope2') }))
    })

    it('with all defaults', () => {
      vimeo.generateClientCredentials()

      const expectedPayload = {
        method: 'POST',
        hostname: requestDefaults.hostname,
        path: authEndpoints.clientCredentials,
        query: {
          grant_type: 'client_credentials'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match(expectedPayload))
    })
  })

  describe('callback is called with the expected parameters', () => {
    it('request returns an error', () => {
      const error = 'Request Error'
      const body = { body: 'body' }
      const status = { status: 'status' }
      const headers = { headers: 'headers' }
      const mockRequest = sinon.fake.yields(error, body, status, headers)
      sinon.replace(vimeo, 'request', mockRequest)
      const mockCallback = sinon.fake()

      vimeo.generateClientCredentials('scope', mockCallback)
      sinon.assert.calledOnce(mockCallback)
      sinon.assert.calledWith(mockCallback, error, null, status, headers)
    })

    it('request is successful', () => {
      const body = { body: 'body' }
      const status = { status: 'status' }
      const headers = { headers: 'headers' }
      const mockRequest = sinon.fake.yields(null, body, status, headers)
      sinon.replace(vimeo, 'request', mockRequest)
      const mockCallback = sinon.fake()

      vimeo.generateClientCredentials('scope', mockCallback)
      sinon.assert.calledOnce(mockCallback)
      sinon.assert.calledWith(mockCallback, null, body, status, headers)
    })
  })
})

describe('Vimeo.accessToken', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')
  const CODE = 'code'
  const REDIRECT_URI = 'redirectURI'

  afterEach(() => {
    sinon.restore()
  })

  it('request is called with the expected parameters', () => {
    const mockRequest = sinon.fake()
    sinon.replace(vimeo, 'request', mockRequest)

    vimeo.accessToken(CODE, REDIRECT_URI)

    const expectedPayload = {
      method: 'POST',
      hostname: requestDefaults.hostname,
      path: authEndpoints.accessToken,
      query: {
        grant_type: 'authorization_code',
        code: CODE,
        redirect_uri: REDIRECT_URI
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
    sinon.assert.calledOnce(mockRequest)
    sinon.assert.calledWith(mockRequest, sinon.match(expectedPayload))
  })

  describe('callback is called with the expected parameters', () => {
    it('request returns an error', () => {
      const error = 'Request Error'
      const body = { body: 'body' }
      const status = { status: 'status' }
      const headers = { headers: 'headers' }
      const mockRequest = sinon.fake.yields(error, body, status, headers)
      sinon.replace(vimeo, 'request', mockRequest)
      const mockCallback = sinon.fake()

      vimeo.accessToken(CODE, REDIRECT_URI, mockCallback)
      sinon.assert.calledOnce(mockCallback)
      sinon.assert.calledWith(mockCallback, error, null, status, headers)
    })

    it('request is successful', () => {
      const body = { body: 'body' }
      const status = { status: 'status' }
      const headers = { headers: 'headers' }
      const mockRequest = sinon.fake.yields(null, body, status, headers)
      sinon.replace(vimeo, 'request', mockRequest)
      const mockCallback = sinon.fake()

      vimeo.accessToken(CODE, REDIRECT_URI, mockCallback)
      sinon.assert.calledOnce(mockCallback)
      sinon.assert.calledWith(mockCallback, null, body, status, headers)
    })
  })
})

describe('Vimeo.setAccessToken', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')

  it('changes the access token', () => {
    vimeo.setAccessToken('token2')
    expect(vimeo._accessToken).to.equal('token2')
  })
})

describe('Vimeo._applyQuerystringParams', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')
  const PATH = '/path'
  const PATH_QS = '/path?a=b'
  const QS = { c: 'd' }

  it('returns the path if no query is passed', () => {
    const newPath = vimeo._applyQuerystringParams({ path: PATH }, {})
    expect(newPath).to.equal(PATH)
  })

  it('returns the path if no query is passed', () => {
    const newPath = vimeo._applyQuerystringParams({ path: PATH_QS }, {})
    expect(newPath).to.equal(PATH_QS)
  })

  it('adds the query string after the ?', () => {
    const newPath = vimeo._applyQuerystringParams({ path: PATH }, { query: QS })
    expect(newPath).to.equal(PATH + '?c=d')
  })

  it('appens the query string after the &', () => {
    const newPath = vimeo._applyQuerystringParams({ path: PATH_QS }, { query: QS })
    expect(newPath).to.equal(PATH_QS + '&c=d')
  })
})

describe('Vimeo.request', () => {
  afterEach(() => {
    sinon.restore()
  })

  const vimeo = new Vimeo('id', 'secret', 'token')

  it('calls callback with an error if options has no path', () => {
    const mockCallback = sinon.fake()
    vimeo.request({}, mockCallback)

    sinon.assert.calledOnce(mockCallback)
    sinon.assert.calledWith(mockCallback, sinon.match.instanceOf(Error))
  })

  describe('client.request is called with the expected options', () => {
    let mockHttpRequest, mockHttpsRequest, mockReq
    beforeEach(() => {
      mockReq = new events.EventEmitter()
      mockReq.on = sinon.fake(mockReq.on)
      mockReq.end = sinon.fake()
      mockReq.write = sinon.fake()

      mockHttpRequest = sinon.fake.returns(mockReq)
      sinon.replace(http, 'request', mockHttpRequest)
      mockHttpsRequest = sinon.fake.returns(mockReq)
      sinon.replace(https, 'request', mockHttpsRequest)
    })

    it('parses options if passed as a string', () => {
      vimeo.request('https://example.com:1234/path', () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ method: 'GET', path: '/path', host: 'example.com', port: '1234' }))
    })

    it('adds a leading slash if missing', () => {
      vimeo.request({ path: 'path' }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ path: '/path' }))
    })

    it('uses https client when requested', () => {
      vimeo.request({ protocol: 'https:', path: '/path' }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.notCalled(mockHttpRequest)
    })

    it('uses http client by default', () => {
      vimeo.request({ protocol: 'proto:', path: '/path' }, () => { })

      sinon.assert.calledOnce(mockHttpRequest)
      sinon.assert.notCalled(mockHttpsRequest)
    })

    it('sends body as JSON if content type is application/json', () => {
      vimeo.request({ method: 'POST', path: '/path', query: { a: 'b' }, headers: { 'Content-Type': 'application/json' } }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ body: '{"a":"b"}' }))
    })

    it('sends form data as string if content type is application/x-www-form-urlencoded', () => {
      vimeo.request({ method: 'POST', path: '/path', query: { a: 'b', c: 'd' }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ body: 'a=b&c=d' }))
    })

    it('sends body as it is if content type is not application/x-www-form-urlencoded nor application/json', () => {
      vimeo.request({ method: 'POST', path: '/path', body: 'text', headers: { 'Content-Type': 'text/plain' } }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ body: 'text' }))
    })

    it('sets the correct body Content-Length', () => {
      vimeo.request({ method: 'POST', path: '/path', query: { a: 'b' }, headers: { 'Content-Type': 'application/json' } }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ headers: sinon.match.has('Content-Length', 9) }))
    })

    it('sets the correct body Content-Length', () => {
      vimeo.request({ method: 'POST', path: '/path' }, () => { })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ headers: sinon.match.has('Content-Length', 0) }))
    })

    it('calls req.write with the body', () => {
      vimeo.request({ method: 'POST', path: '/path', query: { a: 'b' } }, () => { })

      sinon.assert.calledOnce(mockReq.write)
      sinon.assert.calledWith(mockReq.write, '{"a":"b"}')
    })

    it('doesn\'t call req.write if there is no body', () => {
      vimeo.request({ method: 'POST', path: '/path' }, () => { })

      sinon.assert.notCalled(mockReq.write)
    })

    it('sets on error listener', () => {
      const mockCallback = sinon.fake()
      vimeo.request({ path: '/path' }, mockCallback)

      sinon.assert.calledOnce(mockReq.on)
      sinon.assert.calledWith(mockReq.on, 'error', sinon.match.func)

      mockReq.emit('error', 'Error Emitted')
      sinon.assert.calledOnce(mockCallback)
      sinon.assert.calledWith(mockCallback, 'Error Emitted')
    })

    it('calls req.end()', () => {
      vimeo.request({ path: '/path' }, () => { })

      sinon.assert.calledOnce(mockReq.end)
    })
  })
})

describe('Vimeo._handleRequest', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')

  let mockRes
  beforeEach(() => {
    mockRes = new events.EventEmitter()
    mockRes.on = sinon.fake(mockRes.on)
    mockRes.setEncoding = sinon.fake()
    mockRes.headers = { headers: 'value' }
  })

  afterEach(() => {
    sinon.restore()
  })

  it('sets the encoding to utf8', () => {
    const handler = vimeo._handleRequest(() => { })
    handler(mockRes)
    sinon.assert.calledOnce(mockRes.setEncoding)
    sinon.assert.calledWith(mockRes.setEncoding, 'utf8')
  })

  it('calls callback with an error if status code >= 400', () => {
    const mockCallback = sinon.fake()
    const handler = vimeo._handleRequest(mockCallback)

    mockRes.statusCode = 404
    handler(mockRes)

    mockRes.emit('end')
    sinon.assert.calledOnce(mockCallback)
    sinon.assert.calledWith(mockCallback, sinon.match.instanceOf(Error), '', mockRes.statusCode, mockRes.headers)
  })

  it('calls callback no error if status code < 400', () => {
    const mockCallback = sinon.fake()
    const handler = vimeo._handleRequest(mockCallback)

    mockRes.statusCode = 200
    handler(mockRes)

    mockRes.emit('end')
    sinon.assert.calledOnce(mockCallback)
    sinon.assert.calledWith(mockCallback, null, {}, mockRes.statusCode, mockRes.headers)
  })

  it('calls callback with an error if the body is not valid JSON', () => {
    const mockCallback = sinon.fake()
    const handler = vimeo._handleRequest(mockCallback)

    mockRes.read = sinon.fake.returns('{"bad": "json"')

    mockRes.statusCode = 200
    handler(mockRes)

    mockRes.emit('readable')
    mockRes.emit('end')
    sinon.assert.calledOnce(mockCallback)
    sinon.assert.calledWith(mockCallback, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Unexpected end of JSON input')), '{"bad": "json"', mockRes.statusCode, mockRes.headers)
  })

  it('calls callback the body parsed as JSON', () => {
    const mockCallback = sinon.fake()
    const handler = vimeo._handleRequest(mockCallback)

    mockRes.read = sinon.fake.returns('{"good": "json"}')

    mockRes.statusCode = 200
    handler(mockRes)

    mockRes.emit('readable')
    mockRes.emit('end')
    sinon.assert.calledOnce(mockCallback)
    sinon.assert.calledWith(mockCallback, null, { good: 'json' }, mockRes.statusCode, mockRes.headers)
  })
})

describe('Vimeo.upload', () => {
  const FILE_NAME = '/real/file'
  const FILE_SIZE = 24601

  const vimeo = new Vimeo('id', 'secret', 'token')

  let mockCompleteCallback
  let mockProgressCallback
  let mockErrorCallback

  beforeEach(() => {
    mockCompleteCallback = sinon.fake()
    mockProgressCallback = sinon.fake()
    mockErrorCallback = sinon.fake()
  })
  afterEach(() => {
    sinon.restore()
  })

  it('calls the errorCallback if the file is inexistant', () => {
    const errFs = sinon.fake.throws('File Error')
    sinon.replace(fs, 'statSync', errFs)

    const vimeo = new Vimeo('id', 'secret', 'token')
    vimeo.upload(FILE_NAME, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    sinon.assert.calledOnce(mockErrorCallback)
    sinon.assert.calledWith(mockErrorCallback, 'Unable to locate file to upload.')
  })

  describe('file parameter is an object', () => {
    it('request is called with the expected parameters', () => {
      const mockRequest = sinon.fake()
      sinon.replace(vimeo, 'request', mockRequest)

      const fileObject = {
        size: FILE_SIZE
      }
      vimeo.upload(fileObject, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockRequest)
      const expectedPayload = {
        method: 'POST',
        path: '/me/videos?fields=uri,name,upload',
        query: { upload: { approach: 'tus', size: FILE_SIZE } }
      }
      sinon.assert.calledWith(mockRequest, expectedPayload)
    })
  })

  describe('file exists', () => {
    beforeEach(() => {
      const mockFs = sinon.fake.returns({ size: FILE_SIZE })
      sinon.replace(fs, 'statSync', mockFs)
    })

    describe('always uses `tus` to upload', () => {
      let mockRequest
      beforeEach(() => {
        mockRequest = sinon.fake()
        sinon.replace(vimeo, 'request', mockRequest)
      })

      it('if upload.approach is not specified', () => {
        vimeo.upload(FILE_NAME, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

        sinon.assert.calledOnce(mockRequest)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(mockRequest, sinon.match(expectedPayload))
      })

      it('if upload.approach is not tus', () => {
        vimeo.upload(FILE_NAME, { upload: { approach: 'not-tus' } }, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

        sinon.assert.calledOnce(mockRequest)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(mockRequest, sinon.match(expectedPayload))
      })
    })

    it('request is called with the expected parameters', () => {
      const mockRequest = sinon.fake()
      sinon.replace(vimeo, 'request', mockRequest)

      vimeo.upload(FILE_NAME, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockRequest)
      const expectedPayload = {
        method: 'POST',
        path: '/me/videos?fields=uri,name,upload',
        query: { upload: { approach: 'tus', size: FILE_SIZE } }
      }
      sinon.assert.calledWith(mockRequest, expectedPayload)
    })

    it('calls the errorCallback if request returned an error', () => {
      const mockRequest = sinon.fake.yields('Request Error')
      sinon.replace(vimeo, 'request', mockRequest)

      vimeo.upload(FILE_NAME, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockErrorCallback)
      sinon.assert.calledWith(mockErrorCallback, sinon.match('Request Error'))
    })

    it('calls _performTusUpload with the expected parameters', () => {
      const mockRequest = sinon.fake.yields(null, {})
      sinon.replace(vimeo, 'request', mockRequest)

      const mockTusUpload = sinon.fake()
      sinon.replace(vimeo, '_performTusUpload', mockTusUpload)

      vimeo.upload(FILE_NAME, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    })

    it('shifts callbacks if param is not passed to the function', () => {
      const mockRequest = sinon.fake.yields(null, {})
      sinon.replace(vimeo, 'request', mockRequest)

      const mockTusUpload = sinon.fake()
      sinon.replace(vimeo, '_performTusUpload', mockTusUpload)

      vimeo.upload(FILE_NAME, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    })
  })
})

describe('Vimeo.replace', () => {
  const FILE_NAME = '/real/file/name'
  const FILE_SIZE = 24601
  const VIDEO_URI = '/videos/123456789'

  const vimeo = new Vimeo('id', 'secret', 'token')

  let mockCompleteCallback
  let mockProgressCallback
  let mockErrorCallback

  beforeEach(() => {
    mockCompleteCallback = sinon.fake()
    mockProgressCallback = sinon.fake()
    mockErrorCallback = sinon.fake()
  })
  afterEach(() => {
    sinon.restore()
  })

  it('calls the errorCallback if the file is inexistant', () => {
    const errFs = sinon.fake.throws('File Error')
    sinon.replace(fs, 'statSync', errFs)

    const vimeo = new Vimeo('id', 'secret', 'token')
    vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    sinon.assert.calledOnce(mockErrorCallback)
    sinon.assert.calledWith(mockErrorCallback, 'Unable to locate file to upload.')
  })

  describe('file parameter is an object', () => {
    it('request is called with the expected parameters', () => {
      const mockRequest = sinon.fake()
      sinon.replace(vimeo, 'request', mockRequest)

      const fileObject = {
        size: FILE_SIZE,
        name: 'name'
      }
      vimeo.replace(fileObject, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockRequest)
      const expectedPayload = {
        method: 'POST',
        path: VIDEO_URI + '/versions?fields=upload',
        query: { file_name: 'name', upload: { approach: 'tus', size: FILE_SIZE } }
      }
      sinon.assert.calledWith(mockRequest, expectedPayload)
    })
  })

  describe('file exists', () => {
    beforeEach(() => {
      const mockFs = sinon.fake.returns({ size: FILE_SIZE })
      sinon.replace(fs, 'statSync', mockFs)
    })

    describe('always uses `tus` to upload', () => {
      let mockRequest
      beforeEach(() => {
        mockRequest = sinon.fake()
        sinon.replace(vimeo, 'request', mockRequest)
      })

      it('if upload.approach is not specified', () => {
        vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

        sinon.assert.calledOnce(mockRequest)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(mockRequest, sinon.match(expectedPayload))
      })

      it('if upload.approach is not tus', () => {
        vimeo.replace(FILE_NAME, VIDEO_URI, { upload: { approach: 'not-tus' } }, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

        sinon.assert.calledOnce(mockRequest)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(mockRequest, sinon.match(expectedPayload))
      })
    })

    it('request is called with the expected parameters', () => {
      const mockRequest = sinon.fake()
      sinon.replace(vimeo, 'request', mockRequest)

      vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockRequest)
      const expectedPayload = {
        method: 'POST',
        path: VIDEO_URI + '/versions?fields=upload',
        query: { file_name: 'name', upload: { approach: 'tus', size: FILE_SIZE } }
      }
      sinon.assert.calledWith(mockRequest, expectedPayload)
    })

    it('calls the errorCallback if request returned an error', () => {
      const mockRequest = sinon.fake.yields('Request Error')
      sinon.replace(vimeo, 'request', mockRequest)

      vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockErrorCallback)
      sinon.assert.calledWith(mockErrorCallback, sinon.match('Request Error'))
    })

    it('calls _performTusUpload with the expected parameters', () => {
      const mockRequest = sinon.fake.yields(null, {})
      sinon.replace(vimeo, 'request', mockRequest)

      const mockTusUpload = sinon.fake()
      sinon.replace(vimeo, '_performTusUpload', mockTusUpload)

      vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, { uri: VIDEO_URI }, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    })

    it('shifts callbacks if param is not passed to the function', () => {
      const mockRequest = sinon.fake.yields(null, {})
      sinon.replace(vimeo, 'request', mockRequest)

      const mockTusUpload = sinon.fake()
      sinon.replace(vimeo, '_performTusUpload', mockTusUpload)

      vimeo.replace(FILE_NAME, VIDEO_URI, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, { uri: VIDEO_URI }, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    })
  })
})
