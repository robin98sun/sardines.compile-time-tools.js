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
import * as path from 'path'

export const dumpClass = async(className: string, packClass: any, filepath: string) => {
  if (typeof packClass !== 'function') {
    throw `can not dump class [${packClass}], it's not a valid class`
  }

  let lineNumber = 0
  const writeline = async(line: string) => {
    if (lineNumber === 0) {
      fs.writeFileSync(filepath, line + '\n\n')
    } else {
      fs.appendFileSync(filepath, line + '\n\n')
    }
    lineNumber++
  }

  await writeline(`export const ${className} = ` + packClass.toString())
  for (let staticMethod in packClass) {
    await writeline(`${className}.${staticMethod} = ` + packClass[staticMethod].toString())
  }
  for (let instMethod in packClass.prototype) {
    await writeline(`${className}.prototype.${instMethod} = ` + packClass.prototype[instMethod].toString())
  }
}

export const cacheDrivers = async (drivers: Sardines.DriverSettings[], driverDir: string, writelineFunc: any = null ) => {
  const writeline = writelineFunc ? writelineFunc : () => {}
  const driverCache :{[name: string]: any}= {}
  let hasDrivers = false
  writeline(`export const drivers: {[key:string]:any} = {`)
  if (drivers && drivers.length) {
    for (let driver of drivers) {
      if (driver.locationType === Sardines.LocationType.npm_link || driver.locationType === Sardines.LocationType.npm) {
        let driverClass = await Source.getPackageFromNpm(driver.name, driver.locationType)
        driverClass = utils.getDefaultClassFromPackage(driverClass)
        if (driverClass && typeof driverClass === 'function') {
          driverCache[driver.name] = driverClass
          const driverFilepath = path.join(driverDir, `./${driver.name}.js`)
          await dumpClass('f', driverClass, driverFilepath)
          writeline(`  "${driver.name}": require('${driverFilepath}').f,`)
          hasDrivers = true
        }
      }
    }
  }
  writeline('}')

  // if (hasDrivers) {
  //   writeline('for (let d in drivers) {')
  //   writeline('  if (drivers[d] && drivers[d].default) {')
  //   writeline('     drivers[d] = drivers[d].default')
  //   writeline('  }')
  //   writeline('}')
  // }
  
  return driverCache
}