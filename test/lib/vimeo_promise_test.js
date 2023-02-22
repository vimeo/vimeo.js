/* eslint-env mocha */
'use strict'

const Vimeo = require('../../lib/vimeo').Vimeo
const requestDefaults = require('../../lib/vimeo').request_defaults
const authEndpoints = require('../../lib/vimeo').authEndpoints
const fs = require('fs') // Needed for mocking
const http = require('http') // Needed for mocking
const https = require('https') // Needed for mocking
const events = require('events')
const expect = require('chai').expect
const sinon = require('sinon')

afterEach(() => {
  sinon.restore()
})

describe('Vimeo.request using the Promise API', () => {
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

describe('Vimeo.accessToken using the Promise API', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')
  const CODE = 'code'
  const REDIRECT_URI = 'redirectURI'
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

describe('Vimeo.generateClientCredentials using the Promise API', () => {
  const vimeo = new Vimeo('id', 'secret', 'token')
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

  describe('when the callback is not passed in', () => {
    it('request returns an error', async () => {
      const error = new Error('Request Error')
      requestStub.rejects(error)

      await vimeo.generateClientCredentials('scope').catch(err => sinon.assert.match(err, error))
    })

    it('request is successful', async () => {
      const body = 'body'
      requestStub.resolves(body)

      await vimeo.generateClientCredentials('scope').then(res => sinon.assert.match(res, body))
    })
  })
})

describe('Vimeo.upload using the Promise API', () => {
  const FILE_NAME = '/real/file'
  const FILE_SIZE = 24601
  const vimeo = new Vimeo('id', 'secret', 'token')
  const attempt = { body: { upload: { upload_link: 'body' }, uri: 'uri' } }
  let requestStub
  let mockProgressCallback

  beforeEach(() => {
    requestStub = sinon.stub(vimeo, 'request').resolves(attempt)
    mockProgressCallback = sinon.fake()
  })

  it('throws an error if the file is inexistant', async () => {
    const error = new Error('File Error')
    const errFs = sinon.fake.throws(error)
    sinon.replace(fs, 'statSync', errFs)

    const vimeo = new Vimeo('id', 'secret', 'token')
    await vimeo.upload(FILE_NAME, {}).catch(err => {
      sinon.assert.match(err, error)
    })
  })

  it('throws an error if the file parameter is an object', async () => {
    const fileObject = { size: 123 }
    await vimeo.upload(fileObject, {}).catch(err => sinon.assert.match(err, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Please pass in a valid file path.'))))
  })

  describe('file exists', () => {
    let mockTusUpload
    beforeEach(() => {
      const mockFs = sinon.fake.returns({ size: FILE_SIZE })
      mockTusUpload = sinon.stub(vimeo, '_performTusUpload').callsFake((files, size, attempt, onComplete, onProgress, onError) => onComplete('uri'))
      sinon.replace(fs, 'statSync', mockFs)
    })

    describe('always uses `tus` to upload', () => {
      it('if upload.approach is not specified', async () => {
        await vimeo.upload(FILE_NAME, {})

        sinon.assert.calledOnce(requestStub)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(requestStub, sinon.match(expectedPayload))
      })

      it('if upload.approach is not tus', async () => {
        await vimeo.upload(FILE_NAME, { upload: { approach: 'not-tus' } })

        sinon.assert.calledOnce(requestStub)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(requestStub, sinon.match(expectedPayload))
      })
    })

    it('request is called with the expected parameters', async () => {
      await vimeo.upload(FILE_NAME, {})

      sinon.assert.calledOnce(requestStub)
      const expectedPayload = {
        method: 'POST',
        path: '/me/videos?fields=uri,name,upload',
        query: { upload: { approach: 'tus', size: FILE_SIZE } }
      }
      sinon.assert.calledWith(requestStub, expectedPayload)
    })

    it('calls the onError if request returned an error', async () => {
      const error = new Error('Request Error')
      requestStub.rejects(error)

      await vimeo.upload(FILE_NAME, {}).catch(err => sinon.assert.match(err, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Unable to initiate an upload. [Request Error]'))))
    })

    it('calls _performTusUpload with the expected parameters', async () => {
      await vimeo.upload(FILE_NAME, {}, mockProgressCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, attempt.body, sinon.match.typeOf('function'), mockProgressCallback, sinon.match.typeOf('function'))
    })

    it('shifts callbacks if param is not passed to the function', async () => {
      await vimeo.upload(FILE_NAME, mockProgressCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, attempt.body, sinon.match.typeOf('function'), mockProgressCallback, sinon.match.typeOf('function'))
    })

    it('returns uri when upload completes', async () => {
      await vimeo.upload(FILE_NAME, mockProgressCallback).then((res) => sinon.assert.match(res, 'uri'))
    })

    it('returns error when upload fails', async () => {
      const error = new Error('Upload Error')
      mockTusUpload.resetBehavior()
      mockTusUpload.callsFake((files, size, attempt, onComplete, onProgress, onError) => onError(error))
      await vimeo.upload(FILE_NAME, mockProgressCallback).catch((err) => {
        sinon.assert.match(err, error)
      })
    })

    it('sents progress through the progressCallback during upload', async () => {
      mockTusUpload.resetBehavior()
      mockTusUpload.callsFake((files, size, attempt, onComplete, onProgress, onError) => {
        onProgress('bytesUploaded', 'bytesTotal')
        onProgress('bytesUploaded2', 'bytesTotal2')
        onComplete()
      })
      await vimeo.upload(FILE_NAME, mockProgressCallback)
      sinon.assert.calledTwice(mockProgressCallback)
      sinon.assert.calledWith(mockProgressCallback.getCall(0), 'bytesUploaded', 'bytesTotal')
      sinon.assert.calledWith(mockProgressCallback.getCall(1), 'bytesUploaded2', 'bytesTotal2')
    })
  })
})

describe('Vimeo.replace using the Promise API', () => {
  const FILE_NAME = '/real/file/name'
  const FILE_SIZE = 24601
  const VIDEO_URI = '/videos/123456789'
  const vimeo = new Vimeo('id', 'secret', 'token')
  const attempt = { upload: { upload_link: 'body' } }
  let requestStub
  let mockProgressCallback

  beforeEach(() => {
    requestStub = sinon.stub(vimeo, 'request').resolves(attempt)
    mockProgressCallback = sinon.fake()
  })

  it('throws an error if the file is inexistant', async () => {
    const error = new Error('File Error')
    const errFs = sinon.fake.throws(error)
    sinon.replace(fs, 'statSync', errFs)

    const vimeo = new Vimeo('id', 'secret', 'token')
    await vimeo.replace(FILE_NAME, VIDEO_URI, {}).catch(err => {
      sinon.assert.match(err, error)
    })
  })

  it('throws an error if the file parameter is an object', async () => {
    const fileObject = { size: 123, name: 'name' }
    await vimeo.replace(fileObject, VIDEO_URI, {}).catch(err => sinon.assert.match(err, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Please pass in a valid file path.'))))
  })

  describe('file exists', () => {
    let mockTusUpload
    beforeEach(() => {
      const mockFs = sinon.fake.returns({ size: FILE_SIZE })
      mockTusUpload = sinon.stub(vimeo, '_performTusUpload').callsFake((files, size, attempt, onComplete, onProgress, onError) => onComplete('uri'))
      sinon.replace(fs, 'statSync', mockFs)
    })

    describe('always uses `tus` to upload', () => {
      it('if upload.approach is not specified', async () => {
        await vimeo.replace(FILE_NAME, VIDEO_URI, {})

        sinon.assert.calledOnce(requestStub)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(requestStub, sinon.match(expectedPayload))
      })

      it('if upload.approach is not tus', async () => {
        await vimeo.replace(FILE_NAME, VIDEO_URI, { upload: { approach: 'not-tus' } })

        sinon.assert.calledOnce(requestStub)
        const expectedPayload = {
          query: { upload: { approach: 'tus' } }
        }
        sinon.assert.calledWith(requestStub, sinon.match(expectedPayload))
      })
    })

    it('request is called with the expected parameters', async () => {
      await vimeo.replace(FILE_NAME, VIDEO_URI, {})

      sinon.assert.calledOnce(requestStub)
      const expectedPayload = {
        method: 'POST',
        path: VIDEO_URI + '/versions?fields=upload',
        query: { file_name: 'name', upload: { approach: 'tus', size: FILE_SIZE } }
      }
      sinon.assert.calledWith(requestStub, expectedPayload)
    })

    it('calls the onError if request returned an error', async () => {
      const error = new Error('Request Error')
      requestStub.rejects(error)

      await vimeo.replace(FILE_NAME, VIDEO_URI, {}).catch(err => sinon.assert.match(err, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Unable to initiate an upload. [Request Error]'))))
    })

    it('calls _performTusUpload with the expected parameters', async () => {
      await vimeo.replace(FILE_NAME, VIDEO_URI, {}, mockProgressCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, attempt.body, sinon.match.typeOf('function'), mockProgressCallback, sinon.match.typeOf('function'))
    })

    it('shifts callbacks if param is not passed to the function', async () => {
      await vimeo.replace(FILE_NAME, VIDEO_URI, mockProgressCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, attempt.body, sinon.match.typeOf('function'), mockProgressCallback, sinon.match.typeOf('function'))
    })

    it('returns uri when upload completes', async () => {
      await vimeo.replace(FILE_NAME, VIDEO_URI, mockProgressCallback).then((res) => sinon.assert.match(res, 'uri'))
    })

    it('returns error when replace fails', async () => {
      const error = new Error('Replace Error')
      mockTusUpload.resetBehavior()
      mockTusUpload.callsFake((files, size, attempt, onComplete, onProgress, onError) => onError(error))
      await vimeo.replace(FILE_NAME, VIDEO_URI, mockProgressCallback).catch((err) => {
        sinon.assert.match(err, error)
      })
    })

    it('sents progress through the progressCallback during upload', async () => {
      mockTusUpload.resetBehavior()
      mockTusUpload.callsFake((files, size, attempt, onComplete, onProgress, onError) => {
        onProgress('bytesUploaded', 'bytesTotal')
        onProgress('bytesUploaded2', 'bytesTotal2')
        onComplete()
      })
      await vimeo.replace(FILE_NAME, VIDEO_URI, mockProgressCallback)
      sinon.assert.calledTwice(mockProgressCallback)
      sinon.assert.calledWith(mockProgressCallback.getCall(0), 'bytesUploaded', 'bytesTotal')
      sinon.assert.calledWith(mockProgressCallback.getCall(1), 'bytesUploaded2', 'bytesTotal2')
    })
  })
})
