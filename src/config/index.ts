/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-04 11:48:04
 * @modify date 2019-08-04 11:48:04
 * @desc [description]
 */

import * as path from 'path'
import * as fs from 'fs'
import { Sardines } from 'sardines-core'

export const readSardinesConfigFile = (sardinesConfigFile: string):Sardines.Config => {
  if (!fs.existsSync(sardinesConfigFile)) {
    throw(`Sardines configure file [${sardinesConfigFile}] does not exist`)
  }
  
  if (!fs.lstatSync(sardinesConfigFile).isFile()) {
    throw(`Sardines configure file [${sardinesConfigFile}] is invalid`)
  }

  if (path.extname(sardinesConfigFile).toLowerCase() !== '.json') {
    throw(`Sardines configure file [${sardinesConfigFile}] must in JSON format`)
  }
  
  let sardinesConfig:Sardines.Config|null = null
  
  try {
    sardinesConfig = JSON.parse(fs.readFileSync(sardinesConfigFile).toString())
  } catch (e) {
    throw(`Sardines configure file [${sardinesConfigFile}] has broken`)
  }

  // Check content
  if (!sardinesConfig || JSON.stringify(sardinesConfig) === JSON.stringify({})) {
    throw(`Sardines configure file [${sardinesConfigFile}] is empty`)
  }

  if (!sardinesConfig.application || typeof sardinesConfig.application !== 'string') {
    throw(`Application name is missing in sardines configure file [${sardinesConfigFile}]`)
  }

  if (!sardinesConfig.repositoryEntries || !Array.isArray(sardinesConfig.repositoryEntries) || sardinesConfig.repositoryEntries.length === 0){
    throw(`Repository entries are missing in sardines configure file [${sardinesConfigFile}]`)
  }

  if (sardinesConfig.srcRootDir && typeof sardinesConfig.srcRootDir !== 'string') {
    throw(`srcRootDir is wrong in sardines configure file [${sardinesConfigFile}]`)
  }

  if (sardinesConfig.sardinesDir && typeof sardinesConfig.sardinesDir !== 'string') {
    throw(`sardinesDir is wrong in sardines configure file [${sardinesConfigFile}]`)
  }


  // Default values
  if (!sardinesConfig.srcRootDir) sardinesConfig.srcRootDir = './src'
  if (!sardinesConfig.sardinesDir) sardinesConfig.sardinesDir = 'sardines'
  for (let entry of sardinesConfig.repositoryEntries) {
    if (!entry.user && !entry.password ) entry.password = 'anonymous'
    if (!entry.user) entry.user = 'anonymous'
  }

  // if (!sardinesConfig.drivers || !sardinesConfig.drivers.length) {
  //   sardinesConfig.drivers = [{
  //     name: 'sardines-service-driver-http',
  //     locationType: Sardines.LocationType.npm,
  //     protocols: ['http', 'https']
  //   }]
  // }

  return sardinesConfig!
}
