/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-02 17:57:24
 * @modify date 2019-08-02 17:57:24
 * @desc [description]
 */
import { Sardines } from 'sardines-core'
import { RepositoryClient } from 'sardines-core'

// Read remote sardines from repository
export const queryRemoteSardines = async (sardinesConfig: Sardines.Config,  writeline: any) => {
  const cachedApps:any = {}

  for (let appName in sardinesConfig!.remoteServices) {
    const app = sardinesConfig!.remoteServices![appName]
    cachedApps[appName] = {}
    const cachedModules = cachedApps[appName]
    for (let moduleName in app) {
      const sardineModule = app[moduleName]
      let cachedSubModules = cachedModules
      for (let subModule of moduleName.split('/')) {
        if (!subModule) continue
        cachedSubModules[subModule] = {}
        cachedSubModules = cachedSubModules[subModule]
      }
      for (let serviceName in sardineModule) {
        const serviceVersion = sardineModule[serviceName]
        const serviceIdentity = {
          application: appName,
          module: moduleName,
          name: serviceName,
          version: serviceVersion
        }
        // Query Repository for the service
        try {
          const serviceInfo = await RepositoryClient.queryService(serviceIdentity)
          if (!serviceInfo) {
            console.error(`Can not find service information in the repository, service: ${RepositoryClient.genServiceIdentitySting(serviceIdentity)}`)
          } else {
            if (serviceVersion === '*' || serviceVersion === 'latest') {
              serviceInfo.version = serviceVersion
            }
            cachedSubModules[serviceName] = serviceInfo
          }
        } catch (e) {
          console.error(`ERROR when query service ${RepositoryClient.genServiceIdentitySting(serviceIdentity)}:`, e)
        }
      }
    }
  }

  const writeToFile = () => {
    const processSubModule = (name: string, node: any, level:number = 0) => {
      if (Object.keys(node).length> 0 && typeof node.version === 'undefined') {
        writeline(`${'  '.repeat(level+1)}  ${name}: {`)
        for (let subNodeName in node) {
          processSubModule(subNodeName, node[subNodeName], level+1)
        }
        writeline(`${'  '.repeat(level+1)}  },`)
      } else if (typeof node.version !== 'undefined') {
        const getArgs = (full:boolean) => {
          return node.arguments.map((item: string)=> {
                  const parts = item.split(',')
                  let type = parts[1]
                  let name = parts[0]
                  if (['number', 'string', 'boolean'].indexOf(type) < 0) type = 'any'
                  if (full) return `${name}: ${type}`
                  return name
          }).join(', ')
        }
        writeline(`${'  '.repeat(level)}  ${name}: async (${getArgs(true)}) => {`)
        writeline(`${'  '.repeat(level)}    return await Core.invoke({`)
        writeline(`${'  '.repeat(level)}                   application: '${node.application}',`)
        writeline(`${'  '.repeat(level)}                   module: '${node.module}',`)
        writeline(`${'  '.repeat(level)}                   name: '${node.name}',`)
        writeline(`${'  '.repeat(level)}                   version: '${node.version}',`)
        writeline(`${'  '.repeat(level)}                 }, ${getArgs(false)})`)
        writeline(`${'  '.repeat(level)}  },`)
      }
    }
    // Write cache to file
    writeline(`import { Core } from 'sardines-core'`)
    writeline(`export default {`)
    for (let appName in cachedApps) {
      writeline(`  ${appName}: {`)
  
      let modules = cachedApps[appName]
      for (let subModuleName in modules) {
        let subModule = modules[subModuleName]
        processSubModule(subModuleName, subModule)
      }
  
      writeline(`  },`)
    }
    writeline(`}`)
  }
  writeToFile()

}

