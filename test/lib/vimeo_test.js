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

afterEach(() => {
  sinon.restore()
})

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

  describe('request is called with the expected parameters', () => {
    let mockRequest
    beforeEach(() => {
      mockRequest = sinon.fake()
      sinon.replace(vimeo, 'request', mockRequest)
    })

    it('with `public` scope by default', () => {
      vimeo.generateClientCredentials(null, () => {})
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match({ query: sinon.match.has('scope', 'public') }))
    })

    it('with a space-separated list for scopes', () => {
      vimeo.generateClientCredentials(['scope1', 'scope2'], () => {})
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match({ query: sinon.match.has('scope', 'scope1 scope2') }))
    })

    it('with a space-separated list for scopes', () => {
      vimeo.generateClientCredentials('scope1 scope2', () => {})
      sinon.assert.calledOnce(mockRequest)
      sinon.assert.calledWith(mockRequest, sinon.match({ query: sinon.match.has('scope', 'scope1 scope2') }))
    })

    it('with all defaults', () => {
      vimeo.generateClientCredentials(null, () => {})

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

  describe('request is called with the expected parameters for the promise implementation', () => {
    let requestStub
    beforeEach(() => {
      requestStub = sinon.stub(vimeo, 'request').resolves('Success.')
    })

    it('with `public` scope by default', async () => {
      await vimeo.generateClientCredentials()
      sinon.assert.calledOnce(requestStub)
      sinon.assert.calledWith(requestStub, sinon.match({ query: sinon.match.has('scope', 'public') }))
    })

    it('with a space-separated list for scopes', async () => {
      await vimeo.generateClientCredentials(['scope1', 'scope2'])
      sinon.assert.calledOnce(requestStub)
      sinon.assert.calledWith(requestStub, sinon.match({ query: sinon.match.has('scope', 'scope1 scope2') }))
    })

    it('with a space-separated list for scopes', async () => {
      await vimeo.generateClientCredentials('scope1 scope2')
      sinon.assert.calledOnce(requestStub)
      sinon.assert.calledWith(requestStub, sinon.match({ query: sinon.match.has('scope', 'scope1 scope2') }))
    })

    it('with all defaults', async () => {
      await vimeo.generateClientCredentials()

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
      sinon.assert.calledOnce(requestStub)
      sinon.assert.calledWith(requestStub, sinon.match(expectedPayload))
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

  describe('a Promise is returned with the expected response or error when the callback is not passed in', () => {
    it('request returns an error', async () => {
      const error = new Error('Request Error')
      sinon.stub(vimeo, 'request').rejects(error)

      await vimeo.generateClientCredentials('scope').catch(err => sinon.assert.match(err, error))
    })

    it('request is successful', async () => {
      const body = 'body'
      sinon.stub(vimeo, 'request').resolves(body)

      await vimeo.generateClientCredentials('scope').then(res => sinon.assert.match(res, body))
    })
  })
})

describe('Vimeo.accessToken', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')
  const CODE = 'code'
  const REDIRECT_URI = 'redirectURI'

  it('request is called with the expected parameters', () => {
    const mockRequest = sinon.fake()
    sinon.replace(vimeo, 'request', mockRequest)

    vimeo.accessToken(CODE, REDIRECT_URI, () => {})

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

  describe('request and response are expected for the Promise implementation', () => {
    it('vimeo.request is called with the expected parameters', async () => {
      const requestStub = sinon.stub(vimeo, 'request').resolves('Success.')

      await vimeo.accessToken(CODE, REDIRECT_URI)

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
      sinon.assert.calledOnce(requestStub)
      sinon.assert.calledWith(requestStub, sinon.match(expectedPayload))
    })

    it('returns expected error response when the request fails', async () => {
      const err = new Error('Request Error')

      sinon.stub(vimeo, 'request').rejects(err)
      await vimeo.accessToken(CODE, REDIRECT_URI).catch((error) => {
        sinon.assert.match(error, err)
      })
    })

    it('returns the expected response when the request is successful', async () => {
      const body = 'body'

      sinon.stub(vimeo, 'request').resolves(body)

      await vimeo.accessToken(CODE, REDIRECT_URI).then((res) => {
        sinon.assert.match(res, body)
      })
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
  const vimeo = new Vimeo('id', 'secret', 'token')
  let mockHttpRequest, mockHttpsRequest, mockReq, handleRequestStub
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

  describe('callback function is used when passed in', () => {
    it('calls callback with an error if options has no path', () => {
      const mockCallback = sinon.fake()
      vimeo.request({}, mockCallback)

      sinon.assert.calledOnce(mockCallback)
      sinon.assert.calledWith(mockCallback, sinon.match.instanceOf(Error))
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

  describe('a Promise is returned when the callback function is not passed in', () => {
    beforeEach(() => {
      handleRequestStub = sinon.stub(vimeo, '_handleRequest').callsFake((resolve) => { resolve('Success.') })
    })

    it('returns an error if options has no path', async () => {
      const error = sinon.match.instanceOf(Error).and(sinon.match.has('message', 'You must provide an API path.'))
      await vimeo.request({}).catch((e) => sinon.assert.match(e, error))
    })

    it('parses options if passed as a string', async () => {
      await vimeo.request('https://example.com:1234/path')

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ method: 'GET', path: '/path', host: 'example.com', port: '1234' }))
      sinon.assert.calledOnce(handleRequestStub)
    })

    it('adds a leading slash if missing', async () => {
      await vimeo.request({ path: 'path' })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ path: '/path' }))
    })

    it('uses https client when requested', async () => {
      await vimeo.request({ protocol: 'https:', path: '/path' })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.notCalled(mockHttpRequest)
    })

    it('uses http client by default', async () => {
      await vimeo.request({ protocol: 'proto:', path: '/path' })

      sinon.assert.calledOnce(mockHttpRequest)
      sinon.assert.notCalled(mockHttpsRequest)
    })

    it('sends body as JSON if content type is application/json', async () => {
      await vimeo.request({ method: 'POST', path: '/path', query: { a: 'b' }, headers: { 'Content-Type': 'application/json' } })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ body: '{"a":"b"}' }))
    })

    it('sends form data as string if content type is application/x-www-form-urlencoded', async () => {
      await vimeo.request({ method: 'POST', path: '/path', query: { a: 'b', c: 'd' }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ body: 'a=b&c=d' }))
    })

    it('sends body as it is if content type is not application/x-www-form-urlencoded nor application/json', async () => {
      await vimeo.request({ method: 'POST', path: '/path', body: 'text', headers: { 'Content-Type': 'text/plain' } })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ body: 'text' }))
    })

    it('sets the correct body Content-Length', async () => {
      await vimeo.request({ method: 'POST', path: '/path', query: { a: 'b' }, headers: { 'Content-Type': 'application/json' } })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ headers: sinon.match.has('Content-Length', 9) }))
    })

    it('sets the correct body Content-Length', async () => {
      await vimeo.request({ method: 'POST', path: '/path' })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ headers: sinon.match.has('Content-Length', 0) }))
    })

    it('calls req.write with the body', async () => {
      await vimeo.request({ method: 'POST', path: '/path', query: { a: 'b' } })

      sinon.assert.calledOnce(mockReq.write)
      sinon.assert.calledWith(mockReq.write, '{"a":"b"}')
    })

    it('doesn\'t call req.write if there is no body', async () => {
      await vimeo.request({ method: 'POST', path: '/path' })

      sinon.assert.notCalled(mockReq.write)
    })

    it('calls req.end()', async () => {
      await vimeo.request({ path: '/path' })

      sinon.assert.calledOnce(mockReq.end)
    })

    it('returns the correct response when the Promise is fullfilled', async () => {
      const req = await vimeo.request({ method: 'POST', path: '/path' })
      expect(req).to.equal('Success.')
    })

    it('returns the error object when the Promise is rejected', async () => {
      handleRequestStub.resetBehavior()

      const err = new Error('Request Error')
      handleRequestStub.callsFake((resolve, reject) => {
        reject(err)
      })

      await vimeo.request({ method: 'POST', path: '/path' }).catch((e) => {
        expect(e).to.equal(err)
      })
    })

    it('sets on error listener', async () => {
      handleRequestStub.resetBehavior()

      const req = vimeo.request({ path: '/path' }).catch((error) => {
        sinon.assert.match(error, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Error Emitted')))
      })
      mockReq.emit('error', new Error('Error Emitted'))

      sinon.assert.calledOnce(mockReq.on)
      sinon.assert.calledWith(mockReq.on, 'error', sinon.match.func)

      return req
    })

    it('throws an error when the Promise rejects', async () => {
      handleRequestStub.resetBehavior()
      handleRequestStub.callsFake((resolve, reject) => { reject(new Error('Failure.')) })

      const error = sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Failure.'))

      await vimeo.request('https://example.com:1234/path').catch((e) => {
        sinon.assert.match(e, error)
      })

      sinon.assert.calledOnce(mockHttpsRequest)
      sinon.assert.calledWith(mockHttpsRequest, sinon.match({ method: 'GET', path: '/path', host: 'example.com', port: '1234' }))
      sinon.assert.calledOnce(handleRequestStub)
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
    sinon.assert.calledWith(mockCallback, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Unexpected end of JSON input')))
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

  describe('when there is a second fn passed in, calls the second fn on error', () => {
    let mockResolve, mockReject, handler

    beforeEach(() => {
      mockResolve = sinon.fake()
      mockReject = sinon.fake()
      handler = vimeo._handleRequest(mockResolve, mockReject)
    })

    it('sets the encoding to utf8', () => {
      const handler = vimeo._handleRequest(() => { }, () => { })
      handler(mockRes)
      sinon.assert.calledOnce(mockRes.setEncoding)
      sinon.assert.calledWith(mockRes.setEncoding, 'utf8')
    })

    it('calls the second fn with an error if status code >= 400', () => {
      mockRes.statusCode = 404
      handler(mockRes)

      mockRes.emit('end')
      sinon.assert.calledOnce(mockReject)
      sinon.assert.calledWith(mockReject, sinon.match.instanceOf(Error))
    })

    it('calls the first fn with no error if status code < 400', () => {
      mockRes.statusCode = 200
      handler(mockRes)

      mockRes.emit('end')
      sinon.assert.calledOnce(mockResolve)
      sinon.assert.calledWith(mockResolve, { body: {}, headers: mockRes.headers, statusCode: mockRes.statusCode })
    })

    it('calls the second fn with an error if the body is not valid JSON', () => {
      mockRes.read = sinon.fake.returns('{"bad": "json"')

      mockRes.statusCode = 200
      handler(mockRes)

      mockRes.emit('readable')
      mockRes.emit('end')
      sinon.assert.calledOnce(mockReject)
      sinon.assert.calledWith(mockReject,
        sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Unexpected end of JSON input')),
        '{"bad": "json"',
        mockRes.statusCode,
        mockRes.headers)
    })

    it('calls the first fn if the body parsed as JSON', () => {
      mockRes.read = sinon.fake.returns('{"good": "json"}')

      mockRes.statusCode = 200
      handler(mockRes)

      mockRes.emit('readable')
      mockRes.emit('end')
      sinon.assert.calledOnce(mockResolve)
      sinon.assert.calledWith(mockResolve, { body: { good: 'json' }, headers: mockRes.headers, statusCode: mockRes.statusCode })
    })
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

  it('calls the errorCallback if the file is inexistant', () => {
    const errFs = sinon.fake.throws('File Error')
    sinon.replace(fs, 'statSync', errFs)

    const vimeo = new Vimeo('id', 'secret', 'token')
    vimeo.upload(FILE_NAME, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    sinon.assert.calledOnce(mockErrorCallback)
    sinon.assert.calledWith(mockErrorCallback, 'Unable to locate file to upload.')
  })

  it('calls the errorCallback if the file parameter is an object', () => {
    const fileObject = {
      size: FILE_SIZE
    }
    vimeo.upload(fileObject, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

    sinon.assert.calledOnce(mockErrorCallback)
    sinon.assert.calledWith(mockErrorCallback, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Please pass in a valid file path.')))
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

  it('calls the errorCallback if the file is inexistant', () => {
    const errFs = sinon.fake.throws('File Error')
    sinon.replace(fs, 'statSync', errFs)

    const vimeo = new Vimeo('id', 'secret', 'token')
    vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)
    sinon.assert.calledOnce(mockErrorCallback)
    sinon.assert.calledWith(mockErrorCallback, 'Unable to locate file to upload.')
  })

  it('calls the errorCallback if the file parameter is an object', () => {
    const fileObject = {
      size: FILE_SIZE
    }
    vimeo.replace(fileObject, VIDEO_URI, {}, mockCompleteCallback, mockProgressCallback, mockErrorCallback)

    sinon.assert.calledOnce(mockErrorCallback)
    sinon.assert.calledWith(mockErrorCallback, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Please pass in a valid file path.')))
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
