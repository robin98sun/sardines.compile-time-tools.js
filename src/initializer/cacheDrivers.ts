/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-02 17:18:19
 * @modify date 2019-08-02 17:18:19
 * @desc [description]
 */


import { Sardines } from 'sardines-core'
import { Source } from '../sourcing'

export const cacheDrivers = async (drivers: Sardines.DriverSettings[], writelineFunc: any = null ) => {
  const writeline = writelineFunc ? writelineFunc : () => {}
  const driverCache :{[name: string]: any}= {}
  writeline(`export const drivers = {`)
  if (drivers && drivers.length) {
    for (let driver of drivers) {
      if (driver.locationType === Sardines.LocationType.npm_link || driver.locationType === Sardines.LocationType.npm) {
        const driverClass = await Source.getPackageFromNpm(driver.name, driver.locationType)
        if (driverClass && typeof driverClass === 'function') {
          driverCache[driver.name] = driverClass
          writeline(`  "${driver.name}": require('${driver.name}'),`)
        }
      }
    }
  }
  writeline('}')
  return driverCache
}