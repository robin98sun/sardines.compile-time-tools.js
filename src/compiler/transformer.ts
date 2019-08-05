import * as ts from 'typescript'
import { IdentifierSyntax } from './parser'
import { genProxyCode, genService, Service } from './serviceGenerator'
export { Service, getServiceName } from './serviceGenerator'

export const transform = async (appName: string, fileName: string, sardineFileName:string, sourceFilePath: string, identifiers: Map<string, IdentifierSyntax>, referencedTypes: string[], importedIds: string[], proxyIds: string[], line_handler: any) => {
    // generate compiled file to replace original file
    let line_index = 0
    let line = `import * as origin from './${sardineFileName}'\n`
    await line_handler(line, line_index)

    line_index++
    line = `import { Core } from 'sardines-core'\n`
    await line_handler(line, line_index)

    const sardineServices: Service[] = []
    // import types referenced by source code
    for (let t of referencedTypes) {
        let line = null
        if (!identifiers.has(t)) {
            let found = false
            for (let item of importedIds) {
                let [idExp, source] = item.split('|')
                let idName = null, alias = null
                if (idExp.indexOf(':')>0) {
                    [idName, alias] = idExp.split(':')
                } else {
                    idName = idExp
                }
                if (alias) {
                    if (alias === t) {
                        found = true
                        line = `import { ${idName} as ${alias} } from ${source}\n`
                        break
                    }
                } else {
                    if (idName === t) {
                        found = true
                        line = `import { ${idName} } from ${source}\n`
                        break
                    }
                }
            }
            if (!found) throw `type reference '${t}' need to be exported in source file ${sourceFilePath}`
        } else {
            line = `import { ${t} } from './${sardineFileName}'\n`
        }
        if (line) {
            line_index++
            await line_handler(line, line_index)
        }
    }

    for (let item of proxyIds) {
        let [idExp, source] = item.split('|')
        let idName = null, alias = null
        if (idExp.indexOf(':')>0) {
            [idName, alias] = idExp.split(':')
        } else {
            idName = idExp
        }
        let line = `export { ${idName}${alias?' as '+alias:''} } from ${source}\n`
        line_index++
        await line_handler(line, line_index)
    }

    const iterator = identifiers.keys()
    let key = iterator.next()
    while (!key.done) {
        const item: IdentifierSyntax = identifiers.get(key.value)!
        if (item.type === ts.SyntaxKind.InterfaceDeclaration) {
            line = `export { ${item.name} } from './${sardineFileName}'\n`
        } else {
            // This is a service
            const serviceInfo = genService(item, fileName, sourceFilePath)
            line = genProxyCode(appName, item, serviceInfo)
            sardineServices.push(serviceInfo)
        }
        line_index++
        await line_handler(line, line_index)
        key = iterator.next()
    }
    return sardineServices
}