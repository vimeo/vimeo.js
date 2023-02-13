/* eslint-env mocha */
'use strict'

const Vimeo = require('../../lib/vimeo').Vimeo
const fs = require('fs') // Needed for mocking
const sinon = require('sinon')

afterEach(() => {
  sinon.restore()
})

describe('Vimeo.upload using the Promise API', () => {
  const FILE_NAME = '/real/file'
  const FILE_SIZE = 24601
  const vimeo = new Vimeo('id', 'secret', 'token')
  const attempt = { upload: { upload_link: 'body' }, uri: 'uri' }
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
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, attempt, sinon.match.typeOf('function'), mockProgressCallback, sinon.match.typeOf('function'))
    })

    it('shifts callbacks if param is not passed to the function', async () => {
      await vimeo.upload(FILE_NAME, mockProgressCallback)

      sinon.assert.calledOnce(mockTusUpload)
      sinon.assert.calledWith(mockTusUpload, FILE_NAME, FILE_SIZE, attempt, sinon.match.typeOf('function'), mockProgressCallback, sinon.match.typeOf('function'))
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
