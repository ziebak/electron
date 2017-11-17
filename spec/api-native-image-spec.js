'use strict'

const {expect} = require('chai')
const {nativeImage} = require('electron')
const path = require('path')

describe('nativeImage module', () => {
  const ImageFormat = {
    PNG: 'png',
    JPEG: 'jpeg'
  }

  const images = [
    {
      filename: 'logo.png',
      format: ImageFormat.PNG,
      hasAlphaChannel: true,
      hasDataUrl: false,
      width: 538,
      height: 190
    },
    {
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYlWNgAAIAAAUAAdafFs0AAAAASUVORK5CYII=',
      filename: '1x1.png',
      format: ImageFormat.PNG,
      hasAlphaChannel: true,
      hasDataUrl: true,
      height: 1,
      width: 1
    },
    {
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVQYlWP8////fwYGBgYmBigAAD34BABBrq9BAAAAAElFTkSuQmCC',
      filename: '2x2.jpg',
      format: ImageFormat.JPEG,
      hasAlphaChannel: false,
      hasDataUrl: true,
      height: 2,
      width: 2
    },
    {
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAADElEQVQYlWNgIAoAAAAnAAGZWEMnAAAAAElFTkSuQmCC',
      filename: '3x3.png',
      format: ImageFormat.PNG,
      hasAlphaChannel: true,
      hasDataUrl: true,
      height: 3,
      width: 3
    }
  ]

  /**
   * @param {?string} filename
   * @returns {?string} Full path.
   */
  const getImagePathFromFilename = (filename) => {
    return (filename === null) ? null
        : path.join(__dirname, 'fixtures', 'assets', filename)
  }

  /**
   * @param {!Object} image
   * @param {Object} filters
   * @returns {boolean}
   */
  const imageMatchesTheFilters = (image, filters = null) => {
    if (filters === null) {
      return true
    }

    return Object.entries(filters)
        .every(([key, value]) => image[key] === value)
  }

  /**
   * @param {!Object} filters
   * @returns {!Array} A matching images list.
   */
  const getImages = (filters) => {
    const matchingImages = images
        .filter(i => imageMatchesTheFilters(i, filters))

    // Add `.path` property to every image.
    matchingImages
        .forEach(i => { i.path = getImagePathFromFilename(i.filename) })

    return matchingImages
  }

  /**
   * @param {!Object} filters
   * @returns {Object} A matching image if any.
   */
  const getImage = (filters) => {
    const matchingImages = getImages(filters)

    let matchingImage = null
    if (matchingImages.length > 0) {
      matchingImage = matchingImages[0]
    }

    return matchingImage
  }

  describe('createEmpty()', () => {
    it('returns an empty image', () => {
      const empty = nativeImage.createEmpty()
      expect(empty.isEmpty())
      expect(empty.getAspectRatio()).to.equal(1)
      expect(empty.toDataURL()).to.equal('data:image/png;base64,')
      expect(empty.toDataURL({scaleFactor: 2.0})).to.equal('data:image/png;base64,')
      expect(empty.getSize()).to.deep.equal({width: 0, height: 0})
      expect(empty.getBitmap()).to.be.empty
      expect(empty.getBitmap({scaleFactor: 2.0})).to.be.empty
      expect(empty.toBitmap()).to.be.empty
      expect(empty.toBitmap({scaleFactor: 2.0})).to.be.empty
      expect(empty.toJPEG(100)).to.be.empty
      expect(empty.toPNG()).to.be.empty
      expect(empty.toPNG({scaleFactor: 2.0})).to.be.empty

      if (process.platform === 'darwin') {
        expect(empty.getNativeHandle()).to.be.empty
      }
    })
  })

  describe('createFromBuffer(buffer, scaleFactor)', () => {
    it('returns an empty image when the buffer is empty', () => {
      expect(nativeImage.createFromBuffer(Buffer.from([])).isEmpty())
    })

    it('returns an image created from the given buffer', () => {
      const imageA = nativeImage.createFromPath(path.join(__dirname, 'fixtures', 'assets', 'logo.png'))

      const imageB = nativeImage.createFromBuffer(imageA.toPNG())
      expect(imageB.getSize()).to.deep.equal({width: 538, height: 190})
      expect(imageA.toBitmap().equals(imageB.toBitmap())).to.be.true

      const imageC = nativeImage.createFromBuffer(imageA.toJPEG(100))
      expect(imageC.getSize()).to.deep.equal({width: 538, height: 190})

      const imageD = nativeImage.createFromBuffer(imageA.toBitmap(),
        {width: 538, height: 190})
      expect(imageD.getSize()).to.deep.equal({width: 538, height: 190})

      const imageE = nativeImage.createFromBuffer(imageA.toBitmap(),
        {width: 100, height: 200})
      expect(imageE.getSize()).to.deep.equal({width: 100, height: 200})

      const imageF = nativeImage.createFromBuffer(imageA.toBitmap())
      expect(imageF.isEmpty())

      const imageG = nativeImage.createFromBuffer(imageA.toPNG(),
        {width: 100, height: 200})
      expect(imageG.getSize()).to.deep.equal({width: 538, height: 190})

      const imageH = nativeImage.createFromBuffer(imageA.toJPEG(100),
        {width: 100, height: 200})
      expect(imageH.getSize()).to.deep.equal({width: 538, height: 190})

      const imageI = nativeImage.createFromBuffer(imageA.toBitmap(),
        {width: 538, height: 190, scaleFactor: 2.0})
      expect(imageI.getSize()).to.deep.equal({width: 269, height: 95})

      const imageJ = nativeImage.createFromBuffer(imageA.toPNG(), 2.0)
      expect(imageJ.getSize()).to.deep.equal({width: 269, height: 95})
    })
  })

  describe('createFromDataURL(dataURL)', () => {
    it('returns an empty image from the empty string', () => {
      expect(nativeImage.createFromDataURL('').isEmpty())
    })

    it('returns an image created from the given string', () => {
      const imagesData = getImages({hasDataUrl: true})
      for (const imageData of imagesData) {
        const imageFromPath = nativeImage.createFromPath(imageData.path)
        const imageFromDataUrl = nativeImage.createFromDataURL(imageData.dataUrl)

        expect(imageFromDataUrl.isEmpty())
        expect(imageFromDataUrl.getSize()).to.deep.equal(imageFromPath.getSize())
        expect(imageFromDataUrl.toBitmap()).to.satisfy(
            bitmap => imageFromPath.toBitmap().equals(bitmap))
      }
    })
  })

  describe('toDataURL()', () => {
    it('returns a PNG data URL', () => {
      const imagesData = getImages({hasDataUrl: true})
      for (const imageData of imagesData) {
        const imageFromPath = nativeImage.createFromPath(imageData.path)

        expect(imageFromPath.toDataURL()).to.equal(imageData.dataUrl)
        expect(imageFromPath.toDataURL({scaleFactor: 2.0})).to.equal(imageData.dataUrl)
      }
    })

    it('returns a data URL at 1x scale factor by default', () => {
      const imageData = getImage({filename: 'logo.png'})
      const image = nativeImage.createFromPath(imageData.path)

      const imageOne = nativeImage.createFromBuffer(image.toPNG(), {
        width: image.getSize().width,
        height: image.getSize().height,
        scaleFactor: 2.0
      })
      expect(imageOne.getSize()).to.deep.equal(
          {width: imageData.width / 2, height: imageData.height / 2})

      const imageTwo = nativeImage.createFromDataURL(imageOne.toDataURL())
      expect(imageTwo.getSize()).to.deep.equal(
          {width: imageData.width, height: imageData.height})

      expect(imageOne.toBitmap().equals(imageTwo.toBitmap())).to.be.true
    })

    it('supports a scale factor', () => {
      const imageData = getImage({filename: 'logo.png'})
      const image = nativeImage.createFromPath(imageData.path)
      const expectedSize = {width: imageData.width, height: imageData.height}

      const imageFromDataUrlOne = nativeImage.createFromDataURL(
          image.toDataURL({scaleFactor: 1.0}))
      expect(imageFromDataUrlOne.getSize()).to.deep.equal(expectedSize)

      const imageFromDataUrlTwo = nativeImage.createFromDataURL(
          image.toDataURL({scaleFactor: 2.0}))
      expect(imageFromDataUrlTwo.getSize()).to.deep.equal(expectedSize)
    })
  })

  describe('toPNG()', () => {
    it('returns a buffer at 1x scale factor by default', () => {
      const imageData = getImage({filename: 'logo.png'})
      const imageA = nativeImage.createFromPath(imageData.path)

      const imageB = nativeImage.createFromBuffer(imageA.toPNG(), {
        width: imageA.getSize().width,
        height: imageA.getSize().height,
        scaleFactor: 2.0
      })
      expect(imageB.getSize()).to.deep.equal(
          {width: imageData.width / 2, height: imageData.height / 2})

      const imageC = nativeImage.createFromBuffer(imageB.toPNG())
      expect(imageC.getSize()).to.deep.equal(
          {width: imageData.width, height: imageData.height})

      expect(imageB.toBitmap().equals(imageC.toBitmap())).to.be.true
    })

    it('supports a scale factor', () => {
      const imageData = getImage({filename: 'logo.png'})
      const image = nativeImage.createFromPath(imageData.path)

      const imageFromBufferOne = nativeImage.createFromBuffer(
          image.toPNG({scaleFactor: 1.0}))
      expect(imageFromBufferOne.getSize()).to.deep.equal(
          {width: imageData.width, height: imageData.height})

      const imageFromBufferTwo = nativeImage.createFromBuffer(
          image.toPNG({scaleFactor: 2.0}), {scaleFactor: 2.0})
      expect(imageFromBufferTwo.getSize()).to.deep.equal(
          {width: imageData.width / 2, height: imageData.height / 2})
    })
  })

  describe('createFromPath(path)', () => {
    it('returns an empty image for invalid paths', () => {
      expect(nativeImage.createFromPath('').isEmpty())
      expect(nativeImage.createFromPath('does-not-exist.png').isEmpty())
      expect(nativeImage.createFromPath('does-not-exist.ico').isEmpty())
      expect(nativeImage.createFromPath(__dirname).isEmpty())
      expect(nativeImage.createFromPath(__filename).isEmpty())
    })

    it('loads images from paths relative to the current working directory', () => {
      const imagePath = `.${path.sep}${path.join('spec', 'fixtures', 'assets', 'logo.png')}`
      const image = nativeImage.createFromPath(imagePath)
      expect(image.isEmpty()).to.be.false
      expect(image.getSize()).to.deep.equal({width: 538, height: 190})
    })

    it('loads images from paths with `.` segments', () => {
      const imagePath = `${path.join(__dirname, 'fixtures')}${path.sep}.${path.sep}${path.join('assets', 'logo.png')}`
      const image = nativeImage.createFromPath(imagePath)
      expect(image.isEmpty()).to.be.false
      expect(image.getSize()).to.deep.equal({width: 538, height: 190})
    })

    it('loads images from paths with `..` segments', () => {
      const imagePath = `${path.join(__dirname, 'fixtures', 'api')}${path.sep}..${path.sep}${path.join('assets', 'logo.png')}`
      const image = nativeImage.createFromPath(imagePath)
      expect(image.isEmpty()).to.be.false
      expect(image.getSize()).to.deep.equal({width: 538, height: 190})
    })

    it('Gets an NSImage pointer on macOS', function () {
      if (process.platform !== 'darwin') {
        this.skip()
      }

      const imagePath = `${path.join(__dirname, 'fixtures', 'api')}${path.sep}..${path.sep}${path.join('assets', 'logo.png')}`
      const image = nativeImage.createFromPath(imagePath)
      const nsimage = image.getNativeHandle()

      expect(nsimage).to.have.lengthOf(8)

      // If all bytes are null, that's Bad
      const allBytesAreNotNull = nsimage.reduce((acc, x) => acc || (x !== 0), false)
      expect(allBytesAreNotNull)
    })

    it('loads images from .ico files on Windows', function () {
      if (process.platform !== 'win32') {
        this.skip()
      }

      const imagePath = path.join(__dirname, 'fixtures', 'assets', 'icon.ico')
      const image = nativeImage.createFromPath(imagePath)
      expect(image.isEmpty()).to.be.false
      expect(image.getSize()).to.deep.equal({width: 256, height: 256})
    })
  })

  describe('createFromNamedImage(name)', () => {
    it('returns empty for invalid options', () => {
      const image = nativeImage.createFromNamedImage('totally_not_real')
      expect(image.isEmpty())
    })

    it('returns empty on non-darwin platforms', function () {
      if (process.platform === 'darwin') {
        this.skip()
      }

      const image = nativeImage.createFromNamedImage('NSActionTemplate')
      expect(image.isEmpty())
    })

    it('returns a valid image on darwin', function () {
      if (process.platform !== 'darwin') {
        this.skip()
      }

      const image = nativeImage.createFromNamedImage('NSActionTemplate')
      expect(image.isEmpty()).to.be.false
    })

    it('returns allows an HSL shift for a valid image on darwin', function () {
      if (process.platform !== 'darwin') {
        this.skip()
      }

      const image = nativeImage.createFromNamedImage('NSActionTemplate', [0.5, 0.2, 0.8])
      expect(image.isEmpty()).to.be.false
    })
  })

  describe('resize(options)', () => {
    it('returns a resized image', () => {
      const image = nativeImage.createFromPath(path.join(__dirname, 'fixtures', 'assets', 'logo.png'))
      for (const [resizeTo, expectedSize] of new Map([
        [{}, {width: 538, height: 190}],
        [{width: 269}, {width: 269, height: 95}],
        [{width: 600}, {width: 600, height: 212}],
        [{height: 95}, {width: 269, height: 95}],
        [{height: 200}, {width: 566, height: 200}],
        [{width: 80, height: 65}, {width: 80, height: 65}],
        [{width: 600, height: 200}, {width: 600, height: 200}],
        [{width: 0, height: 0}, {width: 0, height: 0}],
        [{width: -1, height: -1}, {width: 0, height: 0}]
      ])) {
        const actualSize = image.resize(resizeTo).getSize()
        expect(actualSize).to.deep.equal(expectedSize)
      }
    })

    it('returns an empty image when called on an empty image', () => {
      expect(nativeImage.createEmpty().resize({width: 1, height: 1}).isEmpty())
      expect(nativeImage.createEmpty().resize({width: 0, height: 0}).isEmpty())
    })

    it('supports a quality option', () => {
      const image = nativeImage.createFromPath(path.join(__dirname, 'fixtures', 'assets', 'logo.png'))
      const good = image.resize({width: 100, height: 100, quality: 'good'})
      const better = image.resize({width: 100, height: 100, quality: 'better'})
      const best = image.resize({width: 100, height: 100, quality: 'best'})

      expect(good.toPNG()).to.have.lengthOf.at.most(better.toPNG().length)
      expect(better.toPNG()).to.have.lengthOf.below(best.toPNG().length)
    })
  })

  describe('crop(bounds)', () => {
    it('returns an empty image when called on an empty image', () => {
      expect(nativeImage.createEmpty().crop({width: 1, height: 2, x: 0, y: 0}).isEmpty())
      expect(nativeImage.createEmpty().crop({width: 0, height: 0, x: 0, y: 0}).isEmpty())
    })

    it('returns an empty image when the bounds are invalid', () => {
      const image = nativeImage.createFromPath(path.join(__dirname, 'fixtures', 'assets', 'logo.png'))
      expect(image.crop({width: 0, height: 0, x: 0, y: 0}).isEmpty())
      expect(image.crop({width: -1, height: 10, x: 0, y: 0}).isEmpty())
      expect(image.crop({width: 10, height: -35, x: 0, y: 0}).isEmpty())
      expect(image.crop({width: 100, height: 100, x: 1000, y: 1000}).isEmpty())
    })

    it('returns a cropped image', () => {
      const image = nativeImage.createFromPath(path.join(__dirname, 'fixtures', 'assets', 'logo.png'))
      const cropA = image.crop({width: 25, height: 64, x: 0, y: 0})
      const cropB = image.crop({width: 25, height: 64, x: 30, y: 40})
      expect(cropA.getSize()).to.deep.equal({width: 25, height: 64})
      expect(cropB.getSize()).to.deep.equal({width: 25, height: 64})
      expect(cropA.toPNG().equals(cropB.toPNG())).to.be.false
    })
  })

  describe('getAspectRatio()', () => {
    it('returns an aspect ratio of an empty image', () => {
      expect(nativeImage.createEmpty().getAspectRatio()).to.equal(1.0)
    })

    it('returns an aspect ratio of an image', () => {
      const imageData = getImage({filename: 'logo.png'})
      // imageData.width / imageData.height = 2.831578947368421
      const expectedAspectRatio = 2.8315789699554443

      const image = nativeImage.createFromPath(imageData.path)
      expect(image.getAspectRatio()).to.equal(expectedAspectRatio)
    })
  })

  describe('addRepresentation()', () => {
    it('supports adding a buffer representation for a scale factor', () => {
      const image = nativeImage.createEmpty()

      const imageDataOne = getImage({width: 1, height: 1})
      image.addRepresentation({
        scaleFactor: 1.0,
        buffer: nativeImage.createFromPath(imageDataOne.path).toPNG()
      })

      const imageDataTwo = getImage({width: 2, height: 2})
      image.addRepresentation({
        scaleFactor: 2.0,
        buffer: nativeImage.createFromPath(imageDataTwo.path).toPNG()
      })

      const imageDataThree = getImage({width: 3, height: 3})
      image.addRepresentation({
        scaleFactor: 3.0,
        buffer: nativeImage.createFromPath(imageDataThree.path).toPNG()
      })

      image.addRepresentation({
        scaleFactor: 4.0,
        buffer: 'invalid'
      })

      expect(image.isEmpty()).to.be.false
      expect(image.getSize()).to.deep.equal({width: 1, height: 1})

      expect(image.toDataURL({scaleFactor: 1.0})).to.equal(imageDataOne.dataUrl)
      expect(image.toDataURL({scaleFactor: 2.0})).to.equal(imageDataTwo.dataUrl)
      expect(image.toDataURL({scaleFactor: 3.0})).to.equal(imageDataThree.dataUrl)
      expect(image.toDataURL({scaleFactor: 4.0})).to.equal(imageDataThree.dataUrl)
    })

    it('supports adding a data URL representation for a scale factor', () => {
      const image = nativeImage.createEmpty()

      const imageDataOne = getImage({width: 1, height: 1})
      image.addRepresentation({
        scaleFactor: 1.0,
        dataURL: imageDataOne.dataUrl
      })

      const imageDataTwo = getImage({width: 2, height: 2})
      image.addRepresentation({
        scaleFactor: 2.0,
        dataURL: imageDataTwo.dataUrl
      })

      const imageDataThree = getImage({width: 3, height: 3})
      image.addRepresentation({
        scaleFactor: 3.0,
        dataURL: imageDataThree.dataUrl
      })

      image.addRepresentation({
        scaleFactor: 4.0,
        dataURL: 'invalid'
      })

      expect(image.isEmpty()).to.be.false
      expect(image.getSize()).to.deep.equal({width: 1, height: 1})

      expect(image.toDataURL({scaleFactor: 1.0})).to.equal(imageDataOne.dataUrl)
      expect(image.toDataURL({scaleFactor: 2.0})).to.equal(imageDataTwo.dataUrl)
      expect(image.toDataURL({scaleFactor: 3.0})).to.equal(imageDataThree.dataUrl)
      expect(image.toDataURL({scaleFactor: 4.0})).to.equal(imageDataThree.dataUrl)
    })

    it('supports adding a representation to an existing image', () => {
      const imageDataOne = getImage({width: 1, height: 1})
      const image = nativeImage.createFromPath(imageDataOne.path)

      const imageDataTwo = getImage({width: 2, height: 2})
      image.addRepresentation({
        scaleFactor: 2.0,
        dataURL: imageDataTwo.dataUrl
      })

      const imageDataThree = getImage({width: 3, height: 3})
      image.addRepresentation({
        scaleFactor: 2.0,
        dataURL: imageDataThree.dataUrl
      })

      expect(image.toDataURL({scaleFactor: 1.0})).to.equal(imageDataOne.dataUrl)
      expect(image.toDataURL({scaleFactor: 2.0})).to.equal(imageDataTwo.dataUrl)
    })
  })
})
