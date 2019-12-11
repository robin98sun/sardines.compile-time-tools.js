/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-02 17:18:19
 * @modify date 2019-08-02 17:18:19
 * @desc [description]
 */


import { Sardines, utils } from 'sardines-core'
import { Source } from '../sourcing'
import * as fs from 'fs'
// import * as path from 'path'

export const dumpClass = (className: string, packClass: any, filepath: string) => {
  if (typeof packClass !== 'function') {
    throw `can not dump class [${packClass}], it's not a valid class`
  }

  let lineNumber = 0
  const writeobj = (obj: any, head: string = '', tail: string = '') => {
    let line: string = ''
    if (typeof obj === 'string') {
      line = `'${obj}'`
    } else {
      line = obj.toString()
    }
    line = head + line + tail
    if (lineNumber === 0) {
      fs.writeFileSync(filepath, line + '\n\n')
    } else {
      fs.appendFileSync(filepath, line + '\n\n')
    }
    lineNumber++
  }

  writeobj(packClass, `export const ${className} = `)
  for (let staticMethod in packClass) {
    writeobj(packClass[staticMethod], `${className}.${staticMethod} = `)
  }
  for (let instMethod in packClass.prototype) {
    writeobj(packClass.prototype[instMethod], `${className}.prototype.${instMethod} = `)
  }
}

export const cacheDrivers = async (drivers: Sardines.DriverSettings[], sardinesDir: string = '', writelineFunc: any = null ) => {
  const writeline = writelineFunc ? writelineFunc : () => {}
  const driverCache :{[name: string]: any}= {}

  // let driverDir = ''
  // if (sardinesDir) {
  //     driverDir = path.join(sardinesDir, './drivers')
  //     fs.mkdirSync(driverDir, {recursive: true})
  // }
  const validDrivers:{[key:string]:any} = {}
  if (drivers && drivers.length) {
    for (let driver of drivers) {
      if (driver.locationType === Sardines.LocationType.npm_link || driver.locationType === Sardines.LocationType.npm) {
        let driverClass = await Source.getPackageFromNpm(driver.name, driver.locationType)
        driverClass = utils.getDefaultClassFromPackage(driverClass)
        if (driverClass && typeof driverClass === 'function') {
          driverCache[driver.name] = driverClass
        }
      }
    }
  }

  writeline(`import { utils } from 'sardines-core'`)
  if (sardinesDir && Object.keys(driverCache).length > 0) {
    const driverVarNames: {[key:string]:string} = {}
    const driverNameList = Object.keys(driverCache)
    for (let i = 0; i<driverNameList.length; i++) {
      const driverName = driverNameList[i]
      const driverVar = `driver_${i}`
      driverVarNames[driverName] = driverVar
      writeline(`import * as ${driverVar} from '${driverName}'`)
    }

    writeline(`
const getClassFromPackage = (packageName) => {
    let pkgcls = require(packageName)
    pkgcls = utils.getDefaultClassFromPackage(pkgcls)
    if (!pkgcls) {
        switch (packageName) {
`)
    for (let driverName in driverVarNames) {
      writeline(`
            case '${driverName}':
                pkgcls = utils.getDefaultClassFromPackage(${driverVarNames[driverName]})
                break

 `)
    }
    writeline(`
        }
    }
    return pkgcls
}
`)

    writeline(`export const drivers: {[key:string]:any} = {`)
    for (let driverName in driverCache) {
      // const driverFilepath = path.join(driverDir, `./${driver.name}.js`)
      // const driverClass = driverCache[driverName]
      // dumpClass('f', driverClass, driverFilepath)
      // writeline(`  "${driver.name}": require('./drivers/${driver.name}.js').f,`)

      writeline(`  "${driverName}": getClassFromPackage('${driverName}'),`)
    }
    writeline('}') 
  }
  
  return driverCache
}