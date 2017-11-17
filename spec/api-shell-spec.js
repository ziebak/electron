const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {shell} = require('electron')

describe('shell module', () => {
  const fixtures = path.resolve(__dirname, 'fixtures')
  const shortcutOptions = {
    target: 'C:\\target',
    description: 'description',
    cwd: 'cwd',
    args: 'args',
    appUserModelId: 'appUserModelId',
    icon: 'icon',
    iconIndex: 1
  }

  // (alexeykuzmin): `.skip()` in `before` doesn't work for nested `describe`s.
  beforeEach(function () {
    if (process.platform !== 'win32') {
      this.skip()
    }
  })

  describe('shell.readShortcutLink(shortcutPath)', () => {
    it('throws when failed', () => {
      assert.throws(() => {
        shell.readShortcutLink('not-exist')
      }, /Failed to read shortcut link/)
    })

    it('reads all properties of a shortcut', () => {
      const shortcut = shell.readShortcutLink(path.join(fixtures, 'assets', 'shortcut.lnk'))
      assert.deepEqual(shortcut, shortcutOptions)
    })
  })

  describe('shell.writeShortcutLink(shortcutPath[, operation], options)', () => {
    const tmpShortcut = path.join(os.tmpdir(), `${Date.now()}.lnk`)

    afterEach(() => {
      fs.unlinkSync(tmpShortcut)
    })

    it('writes the shortcut', () => {
      assert.equal(shell.writeShortcutLink(tmpShortcut, {target: 'C:\\'}), true)
      assert.equal(fs.existsSync(tmpShortcut), true)
    })

    it('correctly sets the fields', () => {
      assert.equal(shell.writeShortcutLink(tmpShortcut, shortcutOptions), true)
      assert.deepEqual(shell.readShortcutLink(tmpShortcut), shortcutOptions)
    })

    it('updates the shortcut', () => {
      assert.equal(shell.writeShortcutLink(tmpShortcut, 'update', shortcutOptions), false)
      assert.equal(shell.writeShortcutLink(tmpShortcut, 'create', shortcutOptions), true)
      assert.deepEqual(shell.readShortcutLink(tmpShortcut), shortcutOptions)
      const change = {target: 'D:\\'}
      assert.equal(shell.writeShortcutLink(tmpShortcut, 'update', change), true)
      assert.deepEqual(shell.readShortcutLink(tmpShortcut), Object.assign(shortcutOptions, change))
    })

    it('replaces the shortcut', () => {
      assert.equal(shell.writeShortcutLink(tmpShortcut, 'replace', shortcutOptions), false)
      assert.equal(shell.writeShortcutLink(tmpShortcut, 'create', shortcutOptions), true)
      assert.deepEqual(shell.readShortcutLink(tmpShortcut), shortcutOptions)
      const change = {
        target: 'D:\\',
        description: 'description2',
        cwd: 'cwd2',
        args: 'args2',
        appUserModelId: 'appUserModelId2',
        icon: 'icon2',
        iconIndex: 2
      }
      assert.equal(shell.writeShortcutLink(tmpShortcut, 'replace', change), true)
      assert.deepEqual(shell.readShortcutLink(tmpShortcut), change)
    })
  })
})
