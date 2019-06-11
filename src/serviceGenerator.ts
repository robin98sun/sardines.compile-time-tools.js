import { IdentifierSyntax } from './parser'
import * as path from 'path'

export const genProxyCode = (item: IdentifierSyntax) => {
    let line = `export const ${item.name} = ${item.isAsync? 'async' : ''} (${item.param?item.param.map(x => x.text).join(', '):''}) => {\n` + 
    // TODO: generate service name
    // register service on the root node
    // check whether the service should run locally or remotely

    // run service locally
    `   return ${item.isAsync? 'await' : ''} origin.${item.name}(${item.param?item.param.map(x => x.name).join(', '):''})\n` +
    `}\n`

    return line
}

export interface Argument {
    name: string
    type: string
    default?: string
}

export interface Service {
    name: string
    module: string
    arguments: Argument[]
    returnType: string
    isAsync: boolean
}

export const getServiceName = (s: Service): string => {
    return `${s.module}:${s.name}`
}

export const genService = (item: IdentifierSyntax, fileName:string, sourceFilePath: string) => {
    const dirname = path.dirname(sourceFilePath)
    let moduleName = (fileName === 'index') ? dirname : `${dirname}/${fileName}`
    if (moduleName[0] !== '/') moduleName = '/' + moduleName
    if (moduleName.toLowerCase() === '/src') moduleName = '/'
    else if (moduleName.toLowerCase().indexOf('/src/') === 0) {
        moduleName = moduleName.substr(4)
    }
    let serviceInfo: Service = {
        name: item.name,
        module: moduleName,
        arguments: [],
        returnType: 'any',
        isAsync: item.isAsync
    }
    if (item.returnType) serviceInfo.returnType = item.returnType
    if (item.param) {
        for (let p of item.param) {
            let [def, defaultValue] = p.text.replace(/ /g, '').split('=')
            let [name, type] = def.split(':')
            let arg: Argument = {
                name, type
            }
            if (defaultValue) arg.default = defaultValue
            serviceInfo.arguments.push(arg)
        }
    }
    return serviceInfo
}