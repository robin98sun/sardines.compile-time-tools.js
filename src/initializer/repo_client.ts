
/** 
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-10-10 19:16
 */
import { RepositoryClient, utils, Sardines } from 'sardines-core'
import { cacheDrivers } from './cacheDrivers'
import * as proc from 'process'
import * as fs from 'fs'

// before using repository client, shall setup some parameters
// 1. platform, which is definitely 'nodejs'
// 2. drivers
// 3. entries
// This part is similar with `initializer`

// Process input arguments
const { params } = utils.parseArgs()

if (!params.config) {
  console.error('--config is required: sardines config file is needed to access repository')
  proc.exit(1)
}

if (!params.cmd) {
  console.error('--cmd is required: repository command')
  proc.exit(1)
}

if (params.help) {
  console.log(`
    sardines-repository-client [--<argument name>[=<argument value>]]
      --help:   print help menu
      --config: required, sardines config file path
      --cmd:    required, repository command name
      --data:   path of data file which in JSON format
  `)
}

// check arguments
if (!fs.existsSync(params.config)) {
  console.error(`sardines config file path [${params.config}] is invalid`)
  proc.exit(1)
}

if (!fs.existsSync(params.data)) {
  console.error(`data file path [${params.data}] is invalid`)
  proc.exit(1)
}

// Read config file
let sardinesConfig: Sardines.Config|null = null
try {
  sardinesConfig = JSON.parse(fs.readFileSync(params.config).toString())
} catch(e) {
  console.error(`invalid config file [${params.config}]`, e)
  proc.exit(1)
}

if (!sardinesConfig || !sardinesConfig.repositoryEntries || !sardinesConfig.drivers) {
  console.error(`invalid config file [${params.config}]: repository entries or drivers are missing`)
  proc.exit(1)
}

// Read data file
let data: any = null
if (params.data) {
  try {
    data = JSON.parse(fs.readFileSync(params.data).toString())
  } catch(e) {
    console.error(`invalid data file [${params.data}]`, e)
    proc.exit(1)
  }
}

const exec = async (config: Sardines.Config, cmd: string, data: any = null) => {
  // Setup repository client
  const drivers = cacheDrivers(config.drivers!)
  RepositoryClient.setupDrivers(drivers)
  RepositoryClient.setupRepositoryEntries(config.repositoryEntries!)
  RepositoryClient.setupPlatform(Sardines.Platform.nodejs)

  return await RepositoryClient.exec(cmd, data)
}

exec(sardinesConfig!, params.cmd, data).then((res: any) => {
  console.log(`repository response for command [${params.cmd}]:`,utils.inspect(res))
}).catch((e:any) => {
  console.error(`Error while invoking repository client [${params.cmd}]:`, e)
  proc.exit(1)
})
