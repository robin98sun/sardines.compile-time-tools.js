
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

if (!params.config && !params.entries && !params.drivers) {
  console.error('--config or [--entries and --driversis] is required: sardines config file is needed to access repository')
  proc.exit(1)
}

if (!params.cmd) {
  console.error('--cmd is required: repository command')
  proc.exit(1)
}

if (params.help) {
  console.log(`
    sardines-repository-client [--<argument name>[=<argument value>]]
      --help:    print help menu
      --config:  sardines config file path
      --entries: repository entries JSON string
      --drivers: drivers settings JSON string
      --cmd:     required, repository command name
      --data:    path of data file which in JSON format, or data in JSON string format
      --init-parameters-file: path of file which contains init parameters
      --provider-settings-file: path of file which contains provider settings
  `)
}

// check arguments
if (params.config && !fs.existsSync(params.config)) {
  console.error(`sardines config file path [${params.config}] is invalid`)
  proc.exit(1)
}

// Read config file
let sardinesConfig: any = null
if (params.config) {
  try {
    sardinesConfig = JSON.parse(fs.readFileSync(params.config).toString())
  } catch(e) {
    console.error(`invalid config file [${params.config}]`, e)
    proc.exit(1)
  }
} else if (params.entries && params.drivers) {
  try {
    sardinesConfig = {
      repositoryEntries: JSON.parse(params.entries),
      drivers: JSON.parse(params.drivers)
    }
  } catch (e) {
    console.error(`invalid entries string or drivers string`, e)
    proc.exit(1)
  }
} else {
  console.error(`--entries and --drivers are both required if --config is omitted`)
  proc.exit(1)
}

if (!sardinesConfig || !sardinesConfig.repositoryEntries || !sardinesConfig.drivers) {
  console.error(`invalid config file [${params.config}]: repository entries or drivers are missing`)
  proc.exit(1)
}

// Read data file
let data: any = null
if (params.data) {
  if (fs.existsSync(params.data)) {
    try {
      data = JSON.parse(fs.readFileSync(params.data).toString())
    } catch(e) {
      console.error(`invalid data file [${params.data}]`, e)
      proc.exit(1)
    }
  } else {
    try {
      data = JSON.parse(params.data)
    } catch(e) {
      console.error(`invalid data string`, e)
      proc.exit(1)
    }
  }
}

if (params['init-parameters-file']) {
  const filepath= params['init-parameters-file']
  if (fs.existsSync(filepath)) {
    try {
      if (!data) {
        data = {}
      }
      data['initParams'] = JSON.parse(fs.readFileSync(filepath).toString())
    } catch(e) {
      console.error(`invalid init parameters file [${filepath}]`)
      proc.exit(1)
    }
  }
}

if (params['provider-settings-file']) {
  const filepath= params['provider-settings-file']
  if (fs.existsSync(filepath)) {
    try {
      if (!data) {
        data = {}
      }
      data['providers'] = JSON.parse(fs.readFileSync(filepath).toString())
    } catch(e) {
      console.error(`invalid provider settings file [${filepath}]`)
      proc.exit(1)
    }
  }
}

const exec = async (config: any, cmd: string, data: any = null) => {
  // Setup repository client
  const drivers = await cacheDrivers(config.drivers!)
  RepositoryClient.setupDrivers(drivers)
  RepositoryClient.setupRepositoryEntries(config.repositoryEntries!)
  RepositoryClient.setupPlatform(Sardines.Platform.nodejs)

  return await RepositoryClient.exec(cmd, data)
}

exec(sardinesConfig!, params.cmd, data).then((res: any) => {
  console.log(`repository response for command [${params.cmd}]:`,utils.inspect(res))
}).catch((e:any) => {
  console.error(`Error while invoking repository client [${params.cmd}]:`, e)
  console.error(`input data:`, utils.inspect(data))
  console.error(`input cmd:`, params.cmd)
  proc.exit(1)
})
