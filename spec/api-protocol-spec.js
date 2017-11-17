const assert = require('assert')
const http = require('http')
const path = require('path')
const qs = require('querystring')
const {closeWindow} = require('./window-helpers')
const {remote} = require('electron')
const {BrowserWindow, ipcMain, protocol, session, webContents} = remote
// The RPC API doesn't seem to support calling methods on remote objects very
// well. In order to test stream protocol, we must work around this limitation
// and use Stream instances created in the browser process.
const stream = remote.require('stream')

describe('protocol module', () => {
  const protocolName = 'sp'
  const text = 'valar morghulis'
  const postData = {
    name: 'post test',
    type: 'string'
  }

  function delay (ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  function getStream (chunkSize = text.length, data = text) {
    const body = stream.PassThrough()

    async function sendChunks () {
      let buf = new Buffer(data)
      for (;;) {
        body.push(buf.slice(0, chunkSize))
        buf = buf.slice(chunkSize)
        if (!buf.length) {
          break
        }
        // emulate network delay
        await delay(50)
      }
      body.push(null)
    }

    sendChunks()
    return body
  }

  afterEach((done) => {
    protocol.unregisterProtocol(protocolName, () => {
      protocol.uninterceptProtocol('http', () => done())
    })
  })

  describe('protocol.register(Any)Protocol', () => {
    const emptyHandler = (request, callback) => callback()

    it('throws error when scheme is already registered', (done) => {
      protocol.registerStringProtocol(protocolName, emptyHandler, (error) => {
        assert.equal(error, null)
        protocol.registerBufferProtocol(protocolName, emptyHandler, (error) => {
          assert.notEqual(error, null)
          done()
        })
      })
    })

    it('does not crash when handler is called twice', (done) => {
      const doubleHandler = (request, callback) => {
        try {
          callback(text)
          callback()
        } catch (error) {
          // Ignore error
        }
      }
      protocol.registerStringProtocol(protocolName, doubleHandler, (error) => {
        if (error) return done(error)

        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sends error when callback is called with nothing', (done) => {
      protocol.registerBufferProtocol(protocolName, emptyHandler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            return done()
          }
        })
      })
    })

    it('does not crash when callback is called in next tick', (done) => {
      const handler = (request, callback) => {
        setImmediate(() => callback(text))
      }
      protocol.registerStringProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })
  })

  describe('protocol.unregisterProtocol', () => {
    it('returns error when scheme does not exist', (done) => {
      protocol.unregisterProtocol('not-exist', (error) => {
        assert.notEqual(error, null)
        done()
      })
    })
  })

  describe('protocol.registerStringProtocol', () => {
    it('sends string as response', (done) => {
      const handler = (request, callback) => callback(text)
      protocol.registerStringProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sets Access-Control-Allow-Origin', (done) => {
      const handler = (request, callback) => callback(text)
      protocol.registerStringProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data, status, request) => {
            assert.equal(data, text)
            assert.equal(request.getResponseHeader('Access-Control-Allow-Origin'), '*')
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sends object as response', (done) => {
      const handler = (request, callback) => {
        callback({
          data: text,
          mimeType: 'text/html'
        })
      }
      protocol.registerStringProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('fails when sending object other than string', (done) => {
      const handler = (request, callback) => callback(new Date())
      protocol.registerBufferProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })
  })

  describe('protocol.registerBufferProtocol', () => {
    const buffer = new Buffer(text)
    it('sends Buffer as response', (done) => {
      const handler = (request, callback) => callback(buffer)
      protocol.registerBufferProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sets Access-Control-Allow-Origin', (done) => {
      const handler = (request, callback) => callback(buffer)
      protocol.registerBufferProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data, status, request) => {
            assert.equal(data, text)
            assert.equal(request.getResponseHeader('Access-Control-Allow-Origin'), '*')
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sends object as response', (done) => {
      const handler = (request, callback) => {
        callback({
          data: buffer,
          mimeType: 'text/html'
        })
      }
      protocol.registerBufferProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('fails when sending string', (done) => {
      const handler = (request, callback) => callback(text)
      protocol.registerBufferProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })
  })

  describe('protocol.registerFileProtocol', () => {
    const filePath = path.join(__dirname, 'fixtures', 'asar', 'a.asar', 'file1')
    const fileContent = require('fs').readFileSync(filePath)
    const normalPath = path.join(__dirname, 'fixtures', 'pages', 'a.html')
    const normalContent = require('fs').readFileSync(normalPath)

    it('sends file path as response', (done) => {
      const handler = (request, callback) => callback(filePath)
      protocol.registerFileProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, String(fileContent))
            return done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sets Access-Control-Allow-Origin', (done) => {
      const handler = (request, callback) => callback(filePath)
      protocol.registerFileProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data, status, request) => {
            assert.equal(data, String(fileContent))
            assert.equal(request.getResponseHeader('Access-Control-Allow-Origin'), '*')
            done()
          },
          error: (xhr, errorType, error) => {
            done(error)
          }
        })
      })
    })

    it('sends object as response', (done) => {
      const handler = (request, callback) => callback({ path: filePath })
      protocol.registerFileProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, String(fileContent))
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('can send normal file', (done) => {
      const handler = (request, callback) => callback(normalPath)
      protocol.registerFileProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, String(normalContent))
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('fails when sending unexist-file', (done) => {
      const fakeFilePath = path.join(__dirname, 'fixtures', 'asar', 'a.asar', 'not-exist')
      const handler = (request, callback) => callback(fakeFilePath)
      protocol.registerFileProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })

    it('fails when sending unsupported content', (done) => {
      const handler = (request, callback) => callback(new Date())
      protocol.registerFileProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })
  })

  describe('protocol.registerHttpProtocol', () => {
    it('sends url as response', (done) => {
      const server = http.createServer((req, res) => {
        assert.notEqual(req.headers.accept, '')
        res.end(text)
        server.close()
      })
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        const url = 'http://127.0.0.1:' + port
        const handler = (request, callback) => callback({url})
        protocol.registerHttpProtocol(protocolName, handler, (error) => {
          if (error) return done(error)
          $.ajax({
            url: protocolName + '://fake-host',
            cache: false,
            success: (data) => {
              assert.equal(data, text)
              done()
            },
            error: (xhr, errorType, error) => done(error)
          })
        })
      })
    })

    it('fails when sending invalid url', (done) => {
      const handler = (request, callback) => callback({url: 'url'})
      protocol.registerHttpProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })

    it('fails when sending unsupported content', (done) => {
      const handler = (request, callback) => callback(new Date())
      protocol.registerHttpProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: () => {
            done('request succeeded but it should not')
          },
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })

    it('works when target URL redirects', (done) => {
      let contents = null
      const server = http.createServer((req, res) => {
        if (req.url === '/serverRedirect') {
          res.statusCode = 301
          res.setHeader('Location', `http://${req.rawHeaders[1]}`)
          res.end()
        } else {
          res.end(text)
        }
      })
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        const url = `${protocolName}://fake-host`
        const redirectURL = `http://127.0.0.1:${port}/serverRedirect`
        const handler = (request, callback) => callback({url: redirectURL})
        protocol.registerHttpProtocol(protocolName, handler, (error) => {
          if (error) return done(error)
          contents = webContents.create({})
          contents.on('did-finish-load', () => {
            assert.equal(contents.getURL(), url)
            server.close()
            contents.destroy()
            done()
          })
          contents.loadURL(url)
        })
      })
    })
  })

  describe('protocol.registerStreamProtocol', () => {
    it('sends Stream as response', (done) => {
      const handler = (request, callback) => callback(getStream())
      protocol.registerStreamProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })

    it('sends object as response', (done) => {
      const handler = (request, callback) => callback({data: getStream()})
      protocol.registerStreamProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data, _, request) => {
            assert.equal(request.status, 200)
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })

    it('sends custom response headers', (done) => {
      const handler = (request, callback) => callback({
        data: getStream(3),
        headers: {
          'x-electron': ['a', 'b']
        }
      })
      protocol.registerStreamProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data, _, request) => {
            assert.equal(request.status, 200)
            assert.equal(request.getResponseHeader('x-electron'), 'a,b')
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })

    it('sends custom status code', (done) => {
      const handler = (request, callback) => callback({
        statusCode: 204,
        data: null
      })
      protocol.registerStreamProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          cache: false,
          success: (data, _, request) => {
            assert.equal(request.status, 204)
            assert.equal(data, undefined)
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })

    it('receives request headers', (done) => {
      const handler = (request, callback) => {
        callback({
          headers: {
            'content-type': 'application/json'
          },
          data: getStream(5, JSON.stringify(Object.assign({}, request.headers)))
        })
      }
      protocol.registerStreamProtocol(protocolName, handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: protocolName + '://fake-host',
          headers: {
            'x-return-headers': 'yes'
          },
          cache: false,
          success: (data) => {
            assert.equal(data['x-return-headers'], 'yes')
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })
  })

  describe('protocol.isProtocolHandled', () => {
    it('returns true for about:', (done) => {
      protocol.isProtocolHandled('about', (result) => {
        assert.equal(result, true)
        done()
      })
    })

    it('returns true for file:', (done) => {
      protocol.isProtocolHandled('file', (result) => {
        assert.equal(result, true)
        done()
      })
    })

    it('returns true for http:', (done) => {
      protocol.isProtocolHandled('http', (result) => {
        assert.equal(result, true)
        done()
      })
    })

    it('returns true for https:', (done) => {
      protocol.isProtocolHandled('https', (result) => {
        assert.equal(result, true)
        done()
      })
    })

    it('returns false when scheme is not registered', (done) => {
      protocol.isProtocolHandled('no-exist', (result) => {
        assert.equal(result, false)
        done()
      })
    })

    it('returns true for custom protocol', (done) => {
      const emptyHandler = (request, callback) => callback()
      protocol.registerStringProtocol(protocolName, emptyHandler, (error) => {
        assert.equal(error, null)
        protocol.isProtocolHandled(protocolName, (result) => {
          assert.equal(result, true)
          done()
        })
      })
    })

    it('returns true for intercepted protocol', (done) => {
      const emptyHandler = (request, callback) => callback()
      protocol.interceptStringProtocol('http', emptyHandler, (error) => {
        assert.equal(error, null)
        protocol.isProtocolHandled('http', (result) => {
          assert.equal(result, true)
          done()
        })
      })
    })
  })

  describe('protocol.intercept(Any)Protocol', () => {
    const emptyHandler = (request, callback) => callback()
    it('throws error when scheme is already intercepted', (done) => {
      protocol.interceptStringProtocol('http', emptyHandler, (error) => {
        assert.equal(error, null)
        protocol.interceptBufferProtocol('http', emptyHandler, (error) => {
          assert.notEqual(error, null)
          done()
        })
      })
    })

    it('does not crash when handler is called twice', (done) => {
      var doubleHandler = (request, callback) => {
        try {
          callback(text)
          callback()
        } catch (error) {
          // Ignore error
        }
      }
      protocol.interceptStringProtocol('http', doubleHandler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('sends error when callback is called with nothing', function (done) {
      if (process.env.TRAVIS === 'true') {
        this.skip()
      }

      protocol.interceptBufferProtocol('http', emptyHandler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: () => done('request succeeded but it should not'),
          error: (xhr, errorType) => {
            assert.equal(errorType, 'error')
            done()
          }
        })
      })
    })
  })

  describe('protocol.interceptStringProtocol', () => {
    it('can intercept http protocol', (done) => {
      const handler = (request, callback) => callback(text)
      protocol.interceptStringProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('can set content-type', (done) => {
      const handler = (request, callback) => {
        callback({
          mimeType: 'application/json',
          data: '{"value": 1}'
        })
      }
      protocol.interceptStringProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(typeof data, 'object')
            assert.equal(data.value, 1)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('can receive post data', (done) => {
      const handler = (request, callback) => {
        const uploadData = request.uploadData[0].bytes.toString()
        callback({data: uploadData})
      }
      protocol.interceptStringProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          type: 'POST',
          data: postData,
          success: (data) => {
            assert.deepEqual(qs.parse(data), postData)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })
  })

  describe('protocol.interceptBufferProtocol', () => {
    it('can intercept http protocol', (done) => {
      const handler = (request, callback) => callback(new Buffer(text))
      protocol.interceptBufferProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })

    it('can receive post data', (done) => {
      const handler = (request, callback) => {
        const uploadData = request.uploadData[0].bytes
        callback(uploadData)
      }
      protocol.interceptBufferProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          type: 'POST',
          data: postData,
          success: (data) => {
            assert.equal(data, $.param(postData))
            done()
          },
          error: (xhr, errorType, error) => done(error)
        })
      })
    })
  })

  describe('protocol.interceptHttpProtocol', () => {
    it('can send POST request', (done) => {
      const server = http.createServer((req, res) => {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.end(body)
        })
        server.close()
      })
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        const url = `http://127.0.0.1:${port}`
        const handler = (request, callback) => {
          const data = {
            url: url,
            method: 'POST',
            uploadData: {
              contentType: 'application/x-www-form-urlencoded',
              data: request.uploadData[0].bytes.toString()
            },
            session: null
          }
          callback(data)
        }
        protocol.interceptHttpProtocol('http', handler, (error) => {
          if (error) return done(error)
          $.ajax({
            url: 'http://fake-host',
            cache: false,
            type: 'POST',
            data: postData,
            success: (data) => {
              assert.deepEqual(qs.parse(data), postData)
              done()
            },
            error: (xhr, errorType, error) => done(error)
          })
        })
      })
    })

    it('can use custom session', (done) => {
      const customSession = session.fromPartition('custom-ses', {cache: false})
      customSession.webRequest.onBeforeRequest((details, callback) => {
        assert.equal(details.url, 'http://fake-host/')
        callback({cancel: true})
      })
      const handler = (request, callback) => {
        callback({
          url: request.url,
          session: customSession
        })
      }
      protocol.interceptHttpProtocol('http', handler, (error) => {
        if (error) return done(error)
        fetch('http://fake-host').then(() => {
          done('request succeeded but it should not')
        }).catch(() => {
          customSession.webRequest.onBeforeRequest(null)
          done()
        })
      })
    })
  })

  describe('protocol.interceptStreamProtocol', () => {
    it('can intercept http protocol', (done) => {
      const handler = (request, callback) => callback(getStream())
      protocol.interceptStreamProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, text)
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })

    it('can receive post data', (done) => {
      const handler = (request, callback) => {
        callback(getStream(3, request.uploadData[0].bytes.toString()))
      }
      protocol.interceptStreamProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          type: 'POST',
          data: postData,
          success: (data) => {
            assert.deepEqual(qs.parse(data), postData)
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })

    it('can execute redirects', (done) => {
      const handler = (request, callback) => {
        if (request.url.indexOf('http://fake-host') === 0) {
          setTimeout(() => {
            callback({
              data: null,
              statusCode: 302,
              headers: {
                Location: 'http://fake-redirect'
              }
            })
          }, 300)
        } else {
          assert.equal(request.url.indexOf('http://fake-redirect'), 0)
          callback(getStream(1, 'redirect'))
        }
      }
      protocol.interceptStreamProtocol('http', handler, (error) => {
        if (error) return done(error)
        $.ajax({
          url: 'http://fake-host',
          cache: false,
          success: (data) => {
            assert.equal(data, 'redirect')
            done()
          },
          error: (xhr, errorType, error) => {
            done(error || new Error(`Request failed: ${xhr.status}`))
          }
        })
      })
    })
  })

  describe('protocol.uninterceptProtocol', () => {
    it('returns error when scheme does not exist', (done) => {
      protocol.uninterceptProtocol('not-exist', (error) => {
        assert.notEqual(error, null)
        done()
      })
    })

    it('returns error when scheme is not intercepted', (done) => {
      protocol.uninterceptProtocol('http', (error) => {
        assert.notEqual(error, null)
        done()
      })
    })
  })

  describe('protocol.registerStandardSchemes', () => {
    const standardScheme = remote.getGlobal('standardScheme')
    const origin = `${standardScheme}://fake-host`
    const imageURL = `${origin}/test.png`
    const filePath = path.join(__dirname, 'fixtures', 'pages', 'b.html')
    const fileContent = '<img src="/test.png" />'
    let w = null
    let success = null

    beforeEach(() => {
      w = new BrowserWindow({show: false})
      success = false
    })

    afterEach((done) => {
      protocol.unregisterProtocol(standardScheme, () => {
        closeWindow(w).then(() => {
          w = null
          done()
        })
      })
    })

    it('resolves relative resources', (done) => {
      const handler = (request, callback) => {
        if (request.url === imageURL) {
          success = true
          callback()
        } else {
          callback(filePath)
        }
      }
      protocol.registerFileProtocol(standardScheme, handler, (error) => {
        if (error) return done(error)
        w.webContents.on('did-finish-load', () => {
          assert(success)
          done()
        })
        w.loadURL(origin)
      })
    })

    it('resolves absolute resources', (done) => {
      const handler = (request, callback) => {
        if (request.url === imageURL) {
          success = true
          callback()
        } else {
          callback({
            data: fileContent,
            mimeType: 'text/html'
          })
        }
      }
      protocol.registerStringProtocol(standardScheme, handler, (error) => {
        if (error) return done(error)
        w.webContents.on('did-finish-load', () => {
          assert(success)
          done()
        })
        w.loadURL(origin)
      })
    })

    it('can have fetch working in it', (done) => {
      const content = '<html><script>fetch("http://github.com")</script></html>'
      const handler = (request, callback) => callback({data: content, mimeType: 'text/html'})
      protocol.registerStringProtocol(standardScheme, handler, (error) => {
        if (error) return done(error)
        w.webContents.on('crashed', () => done('WebContents crashed'))
        w.webContents.on('did-finish-load', () => done())
        w.loadURL(origin)
      })
    })

    it('can access files through the FileSystem API', (done) => {
      let filePath = path.join(__dirname, 'fixtures', 'pages', 'filesystem.html')
      const handler = (request, callback) => callback({path: filePath})
      protocol.registerFileProtocol(standardScheme, handler, (error) => {
        if (error) return done(error)
        w.loadURL(origin)
      })
      ipcMain.once('file-system-error', (event, err) => done(err))
      ipcMain.once('file-system-write-end', () => done())
    })

    it('registers secure, when {secure: true}', (done) => {
      let filePath = path.join(__dirname, 'fixtures', 'pages', 'cache-storage.html')
      const handler = (request, callback) => callback({path: filePath})
      ipcMain.once('success', () => done())
      ipcMain.once('failure', (event, err) => done(err))
      protocol.registerFileProtocol(standardScheme, handler, (error) => {
        if (error) return done(error)
        w.loadURL(origin)
      })
    })
  })
})
