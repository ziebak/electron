#ifndef ATOM_SKIA_UTILS_H_
#define ATOM_SKIA_UTILS_H_

#include "third_party/skia/include/core/SkImageInfo.h"
#include "third_party/skia/include/core/SkPixmap.h"
#include "third_party/skia/include/core/SkBitmap.h"

namespace {

bool copy_to(SkBitmap* dst, SkColorType dstColorType, const SkBitmap& src);

}  // namespace

#endif
