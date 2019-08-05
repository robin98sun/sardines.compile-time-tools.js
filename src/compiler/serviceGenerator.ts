import { IdentifierSyntax } from './parser'
import * as path from 'path'

export const genProxyCode = (appName: string, item: IdentifierSyntax, serviceInfo: Service) => {
    let line = `
export const ${item.name} = ${item.isAsync? 'async' : ''} (${item.param?item.param.map(x => x.text).join(', '):''}) => {
    if (Core.isRemote('${appName}', '${serviceInfo.module}', '${serviceInfo.name}')) {
        ${item.isAsync? 'return await' : 'return new Promise((resolve, reject) => {\n           '} Core.invoke({
        ${item.isAsync? '' : '    '}    application: '${appName}',
        ${item.isAsync? '' : '    '}    module: '${serviceInfo.module}',
        ${item.isAsync? '' : '    '}    name: '${serviceInfo.name}',
        ${item.isAsync? '' : '    '}    version: '*'
        ${item.isAsync? '' : '    '}}` + 
        `${item.param && item.param.length > 0 ? ', ' : ''}` +
        `${item.param?item.param.map(x => x.name).join(', '):''})` +
        `${item.isAsync? '' : '.then(res => resolve(res)).catch(e => reject(e))\n        })'}
    } else {
        return ${item.isAsync? 'await' : ''} origin.${item.name}(${item.param?item.param.map(x => x.name).join(', '):''})
    }
}
`

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
    filepath?: string
}

export const getServiceName = (s: Service): string => {
    return `${s.module}:${s.name}`
}

export const genService = (item: IdentifierSyntax, fileName:string, sourceFilePath: string) => {
    const dirname = path.dirname(sourceFilePath)
    let moduleName = (fileName === 'index') ? dirname : `${dirname}/${fileName}`
    if (moduleName[0] !== '/') moduleName = '/' + moduleName
    if (moduleName.toLowerCase() === '/src') moduleName = '/'
    else if (moduleName.toLowerCase().indexOf('/src/') >= 0) {
        moduleName = moduleName.substr(moduleName.toLowerCase().indexOf('/src/') + 4)
    }
    let filepath = sourceFilePath
    if (filepath.indexOf('src') === 0) filepath = filepath.substr(3)
    else if (filepath.indexOf('/src') === 0) filepath = filepath.substr(4)
    else if (filepath.indexOf('./src') === 0) filepath = filepath.substr(5)
    if (filepath === '') filepath = '/'
    let serviceInfo: Service = {
        name: item.name,
        module: moduleName,
        arguments: [],
        returnType: 'any',
        isAsync: item.isAsync,
        filepath
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