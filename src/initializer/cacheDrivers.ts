/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-02 17:18:19
 * @modify date 2019-08-02 17:18:19
 * @desc [description]
 */


import { Sardines } from 'sardines-core'
import { Source } from '../sourcing'
import * as path from 'path'
import * as fs from 'fs'

export const cacheDrivers = async (sardinesConfig: Sardines.Config, writeline: any, sardinesDir: string) => {
  const driverBaseDir = path.join(sardinesDir, './drivers')
  const driverCache :{[name: string]: any}= {}
  writeline(`export const drivers = {`)
  if (sardinesConfig.drivers && sardinesConfig.drivers.length) {
    for (let driver of sardinesConfig.drivers) {
      if (driver.locationType === Sardines.LocationType.npm_link || driver.locationType === Sardines.LocationType.npm) {
        const driverClass = await Source.getPackageFromNpm(driver.name, driver.locationType)
        if (driverClass && typeof driverClass === 'function') {
          if (!fs.existsSync(driverBaseDir)) {
            // fs.mkdirSync(driverBaseDir)
          }
          // const driverSourceFile = path.join(driverBaseDir, `./${driver.name}.js`)
          // const driverfileWriteline = (line: string, lineNumber: number = -1) => {
          //   fs.writeFileSync(driverSourceFile, line + '\n', {flag: lineNumber === 0 ? 'w': 'a'})
          // }
          // const driverFunctionName = driverClass.name || 'TheDriver'
          // driverfileWriteline(`var ${driverFunctionName} = ${driverClass.toString()}`, 0)
          // for (let staticMethod in driverClass) {
          //   driverfileWriteline(`${driverFunctionName}.${staticMethod} = ${driverClass[staticMethod].toString()}`)
          // }
          // for (let prop in driverClass.prototype) {
          //   let propBody = driverClass.prototype[prop].toString()
          //   if (propBody.indexOf('function') !== 0) {
          //     propBody = `'${propBody}'`
          //   }
          //   driverfileWriteline(`${driverFunctionName}.prototype.${prop} = ${propBody}`)
          // }
          // driverfileWriteline(`module.exports = ${driverFunctionName}`)
          // writeline(`  "${driver.name}": require('./drivers/${driver.name}'),`)
          driverCache[driver.name] = driverClass
          writeline(`  "${driver.name}": require('${driver.name}'),`)
        }
      }
    }
  }
  writeline('}')
  return driverCache
}