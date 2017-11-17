const assert = require('assert')
const Module = require('module')
const path = require('path')
const {remote} = require('electron')
const {BrowserWindow} = remote
const {closeWindow} = require('./window-helpers')

const nativeModulesEnabled = remote.getGlobal('nativeModulesEnabled')

describe('modules support', () => {
  const fixtures = path.join(__dirname, 'fixtures')

  describe('third-party module', () => {
    describe('runas', () => {
      if (!nativeModulesEnabled) return

      it('can be required in renderer', () => {
        require('runas')
      })

      it('can be required in node binary', (done) => {
        const runas = path.join(fixtures, 'module', 'runas.js')
        const child = require('child_process').fork(runas)
        child.on('message', (msg) => {
          assert.equal(msg, 'ok')
          done()
        })
      })
    })

    describe('ffi', () => {
      before(function () {
        if (!nativeModulesEnabled || process.platform === 'win32') {
          this.skip()
        }
      })

      it('does not crash', () => {
        const ffi = require('ffi')
        const libm = ffi.Library('libm', {
          ceil: ['double', ['double']]
        })
        assert.equal(libm.ceil(1.5), 2)
      })
    })

    describe('q', () => {
      const Q = require('q')
      describe('Q.when', () => {
        it('emits the fullfil callback', (done) => {
          Q(true).then((val) => {
            assert.equal(val, true)
            done()
          })
        })
      })
    })

    describe('coffee-script', () => {
      it('can be registered and used to require .coffee files', () => {
        assert.doesNotThrow(() => {
          require('coffee-script').register()
        })
        assert.strictEqual(require('./fixtures/module/test.coffee'), true)
      })
    })
  })

  describe('global variables', () => {
    describe('process', () => {
      it('can be declared in a module', () => {
        assert.strictEqual(require('./fixtures/module/declare-process'), 'declared process')
      })
    })

    describe('global', () => {
      it('can be declared in a module', () => {
        assert.strictEqual(require('./fixtures/module/declare-global'), 'declared global')
      })
    })

    describe('Buffer', () => {
      it('can be declared in a module', () => {
        assert.strictEqual(require('./fixtures/module/declare-buffer'), 'declared Buffer')
      })
    })
  })

  describe('Module._nodeModulePaths', () => {
    describe('when the path is inside the resources path', () => {
      it('does not include paths outside of the resources path', () => {
        let modulePath = process.resourcesPath
        assert.deepEqual(Module._nodeModulePaths(modulePath), [
          path.join(process.resourcesPath, 'node_modules')
        ])

        modulePath = process.resourcesPath + '-foo'
        const nodeModulePaths = Module._nodeModulePaths(modulePath)
        assert(nodeModulePaths.includes(path.join(modulePath, 'node_modules')))
        assert(nodeModulePaths.includes(path.join(modulePath, '..', 'node_modules')))

        modulePath = path.join(process.resourcesPath, 'foo')
        assert.deepEqual(Module._nodeModulePaths(modulePath), [
          path.join(process.resourcesPath, 'foo', 'node_modules'),
          path.join(process.resourcesPath, 'node_modules')
        ])

        modulePath = path.join(process.resourcesPath, 'node_modules', 'foo')
        assert.deepEqual(Module._nodeModulePaths(modulePath), [
          path.join(process.resourcesPath, 'node_modules', 'foo', 'node_modules'),
          path.join(process.resourcesPath, 'node_modules')
        ])

        modulePath = path.join(process.resourcesPath, 'node_modules', 'foo', 'bar')
        assert.deepEqual(Module._nodeModulePaths(modulePath), [
          path.join(process.resourcesPath, 'node_modules', 'foo', 'bar', 'node_modules'),
          path.join(process.resourcesPath, 'node_modules', 'foo', 'node_modules'),
          path.join(process.resourcesPath, 'node_modules')
        ])

        modulePath = path.join(process.resourcesPath, 'node_modules', 'foo', 'node_modules', 'bar')
        assert.deepEqual(Module._nodeModulePaths(modulePath), [
          path.join(process.resourcesPath, 'node_modules', 'foo', 'node_modules', 'bar', 'node_modules'),
          path.join(process.resourcesPath, 'node_modules', 'foo', 'node_modules'),
          path.join(process.resourcesPath, 'node_modules')
        ])
      })
    })

    describe('when the path is outside the resources path', () => {
      it('includes paths outside of the resources path', () => {
        let modulePath = path.resolve('/foo')
        assert.deepEqual(Module._nodeModulePaths(modulePath), [
          path.join(modulePath, 'node_modules'),
          path.resolve('/node_modules')
        ])
      })
    })
  })

  describe('require', () => {
    describe('when loaded URL is not file: protocol', () => {
      let w

      beforeEach(() => {
        w = new BrowserWindow({show: false})
      })

      afterEach(async () => {
        await closeWindow(w)
        w = null
      })

      it('searches for module under app directory', async () => {
        w.loadURL('about:blank')
        const result = await w.webContents.executeJavaScript('typeof require("q").when')
        assert.equal(result, 'function')
      })
    })
  })
})
