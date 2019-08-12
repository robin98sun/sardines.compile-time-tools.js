/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-07-27 21:06:24
 * @modify date 2019-07-27 21:06:24
 * @desc [description]
 */
import { utils } from 'sardines-core'
import * as proc from 'process'
import { Sardines } from 'sardines-core'
import { readSardinesConfigFile } from '../config'
import { RepositoryClient } from 'sardines-core'
import * as path from 'path'
import * as fs from 'fs'
import { queryRemoteSardines } from './queryRemoteSardines'
import { cacheDrivers } from './cacheDrivers'
import { setupRepo } from './setupRepo'

const { params } = utils.parseArgs()

if (params.help) {
  console.log(`
  sardines [--<arg>=<value>] 
  --config=<path>           : set the sardines config file, default is ./sardines-config.json
  --local=<path>            : Service definition file path, default is './sardines-local-services.json'
  `)
  // --exe-dir=<dir>           : Directory path of the executable code files, default is './lib'
  // --repo=<repo url>         : Url of repository, default is 'http://localhost:8080'
  // --user=<user name>        : User of repository, required, the user would be signed up if does not exist
  // --pass=<password>         : Password of the user, required
  proc.exit(0)
}


let sardinesConfigFile = './sardines-config.json'
if (params['config']) {
  sardinesConfigFile = params['config']
}
// let localSardinesServiceDefinitionFile = './sardines-local-services.json'
if (params['local']) {
  // localSardinesServiceDefinitionFile = params['local']
}

let sardinesConfig: Sardines.Config|null = null

try {
  sardinesConfig = readSardinesConfigFile(sardinesConfigFile)
  RepositoryClient.setupRepositoryEntriesBySardinesConfig(sardinesConfig)
} catch (e) {
  console.error(e)
  proc.exit(1)
}

// Prepare local sardines code file path
const sardinesDir = path.join(sardinesConfig!.srcRootDir!, sardinesConfig!.sardinesDir!)
try {
  fs.mkdirSync(sardinesDir, {recursive: true})
} catch (e) {
  console.error(`Can not create sardines directory [${sardinesDir}]:`, e)
  proc.exit(1)
}
const sardinesIndexFile = path.join(sardinesDir, 'index.ts')
try {
  fs.writeFileSync(sardinesIndexFile, '', {flag: 'w'})
} catch (e) {
  console.error(`Can not write sardines file at [${sardinesIndexFile}]:`, e)
  proc.exit(1)
}

const writeline = (line: string, lineNumber: number = -1) => {
  fs.writeFileSync(sardinesIndexFile, line + '\n', {flag: lineNumber === 0 ? 'w': 'a'})
}

// the main loop
const main = async() => {
  // cache drivers
  const drivercache = await cacheDrivers(sardinesConfig!, writeline, sardinesDir)
  RepositoryClient.setupDrivers(drivercache)
  RepositoryClient.setupPlatform(sardinesConfig!.platform)
  // query remote sardines
  await queryRemoteSardines(sardinesConfig!, writeline)
  // setup runtime environment
  await setupRepo(sardinesConfig!, writeline)
}

main().then(()=>{
  console.log(`Remote services have been loaded at ${sardinesIndexFile}`)
}).catch((e:any) => {
  // if(e){}
  console.error('ERROR when querying remote services:', e)
})


  
