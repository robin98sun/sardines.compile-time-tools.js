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

export const dumpClass = (className: string, packClass: any, filepath: string) => {
  if (typeof packClass !== 'function') {
    throw `can not dump class [${packClass}], it's not a valid class`
  }

  let lineNumber = 0
  const writeline = (obj: any) => {
    let line: string = ''
    if (['string'].indexOf(typeof obj) >= 0) {
      line = `'$${obj}'`
    } else {
      line = line.toString()
    }
    if (lineNumber === 0) {
      fs.writeFileSync(filepath, line + '\n\n')
    } else {
      fs.appendFileSync(filepath, line + '\n\n')
    }
    lineNumber++
  }

  writeline(`export const ${className} = ` + packClass.toString())
  for (let staticMethod in packClass) {
    writeline(`${className}.${staticMethod} = ` + packClass[staticMethod].toString())
  }
  for (let instMethod in packClass.prototype) {
    writeline(`${className}.prototype.${instMethod} = ` + packClass.prototype[instMethod].toString())
  }
}

export const cacheDrivers = async (drivers: Sardines.DriverSettings[], sardinesDir: string = '', writelineFunc: any = null ) => {
  const writeline = writelineFunc ? writelineFunc : () => {}
  const driverCache :{[name: string]: any}= {}

  let driverDir = ''
  if (sardinesDir) {
      driverDir = path.join(sardinesDir, './drivers')
      fs.mkdirSync(driverDir, {recursive: true})
  }

  writeline(`export const drivers: {[key:string]:any} = {`)
  if (drivers && drivers.length) {
    for (let driver of drivers) {
      if (driver.locationType === Sardines.LocationType.npm_link || driver.locationType === Sardines.LocationType.npm) {
        let driverClass = await Source.getPackageFromNpm(driver.name, driver.locationType)
        driverClass = utils.getDefaultClassFromPackage(driverClass)
        if (driverClass && typeof driverClass === 'function') {
          driverCache[driver.name] = driverClass
          if (driverDir) {
            const driverFilepath = path.join(driverDir, `./${driver.name}.js`)
            dumpClass('f', driverClass, driverFilepath)
            writeline(`  "${driver.name}": require('./drivers/${driver.name}.js').f,`)
          }
        }
      }
    }
  }
  writeline('}')
  
  return driverCache
}