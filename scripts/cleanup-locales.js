const fs = require('fs')
const path = require('path')

// 查找 release/win-unpacked/locales 目录
const localesDir = path.join(__dirname, '..', 'release', 'win-unpacked', 'locales')

if (fs.existsSync(localesDir)) {
  const files = fs.readdirSync(localesDir)
  files.forEach(file => {
    // 只保留 en-US.pak
    if (file !== 'en-US.pak') {
      const filePath = path.join(localesDir, file)
      fs.unlinkSync(filePath)
      console.log(`Deleted: ${file}`)
    }
  })
  console.log('Locales cleanup completed. Only en-US.pak remains.')
} else {
  console.log('Locales directory not found.')
}
