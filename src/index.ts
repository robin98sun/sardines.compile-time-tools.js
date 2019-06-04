// import * as utils from 'sardines-utils'

// Read command line arguments
import * as proc from 'process'

// Parse the arguments
const params: { [key: string]: any } = {}
const files: string[] = []

for (let i = 2; i < proc.argv.length; i++) {
    const item = proc.argv[i];
    if (item[0] === '-') {
        // is an argument
        const keyAndValue = item.replace(/^-+/, '').split('=')
        if (keyAndValue.length === 1) {
            // boolean type argument
            params[keyAndValue[0]] = true
        } else if (keyAndValue.length === 2) {
            keyAndValue.shift()
            params[keyAndValue[0]] = (keyAndValue).join('=')
        }
    } else {
        // is a file path
        files.push(item)
    }
}

const projectName = params['project'] ? params['project'] : ''

if (params['verbose']) {
    console.log(`processing files belong to project: ${projectName}`)
} else {
    params.verbose = false
}

if (params['print']) {
    params.print = true
} else {
    params.print = false
}

if (params['only-validate']) {
    if (params.verbose) console.log(`only to validate the files`)
    params.only_validate = true    
} else {
    params.only_validate = false
}

if (params['validate']) {
    if (params.verbose) console.log(`validate the files and halt whenever encounter an error`)
    params.validate = true    
} else {
    params.validate = false
}

if (params['recompile']) {
    if (params.verbose) console.log(`recompiling`)
    params.recompile = true
} else {
    params.recompile = false
}

if (params['reverse']) {
    if (params.verbose) console.log(`redo previous compiled files`)
    params.reverse = true
} else {
    params.reverse = false
}



// Compiler 
// Reference: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
import * as fs from "fs"
import * as ts from "typescript"
import * as path from 'path'

interface IdentifierSyntax { 
    name: string
    type: ts.SyntaxKind
    typeStr: string
    isExport: boolean
    isAsync: boolean
    text: string
    param?: IdentifierSyntax[]|null
    typeRef?: string[]
}

export function gatherExports(sourceFile: ts.SourceFile): [Map<string, IdentifierSyntax>, string[]] {
    
    const idnetifiers: Map<string, IdentifierSyntax> = new Map<string, IdentifierSyntax>()
    const referencedTypes: string[] = []

    const storeSyntax = (syntax: IdentifierSyntax) => {
        if (syntax.name) {
            if (idnetifiers.has(syntax.name)) {
                throw `duplicated identifier: ${syntax.name}`
            } else  if (syntax.isExport && [ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.ObjectLiteralExpression, ts.SyntaxKind.ArrayLiteralExpression].indexOf(syntax.type) >= 0) {
                throw `illegal export type: ${ts.SyntaxKind[syntax.type]}`
            } else {
                idnetifiers.set(syntax.name, syntax!)
            }
        }
    }
    const storeReferencedTypes = (types: string[]) => {
        for (let t of types) {
            if (referencedTypes.indexOf(t) <0) referencedTypes.push(t)
        }
    }

    const checkSyntaxType = (node: ts.Node, type: ts.SyntaxKind = ts.SyntaxKind.ExportKeyword):boolean => {
        if (node.kind === type) return true
        let result = false
        if (node.getChildCount() > 0) {
            for (let child of node.getChildren()) {
                if (checkSyntaxType(child, type)) {
                    result = true
                    break
                }
            }
        }
        return result
    }

    const printSyntax = (node: ts.Node, prefix: string = '') => {
        console.log(prefix, ts.SyntaxKind[node.kind], node.getText())
        for (let item of node.getChildren()){
            printSyntax(item, prefix + '    ')
        }
    }

    const getTypeRefInParam = (param: ts.Node): string[] => {
        const result = []
        for (let item of param.getChildren()) {
            if (item.kind === ts.SyntaxKind.TypeReference) {
                result.push(item.getText())
            } else {
                const subResult = getTypeRefInParam(item)
                for (let t of subResult) {
                    if (result.indexOf(t) < 0) {
                        result.push(t)
                    }
                }
            }
        }
        return result
    }

    const getParamSyntax = (node: ts.Node) => {
        let paramSyntax = null, pre = null, preBeforePre = null
        for (let item of node.getChildren()) {
            if (item.kind === ts.SyntaxKind.CloseParenToken) {
                if (pre && pre.kind !== ts.SyntaxKind.OpenParenToken && preBeforePre && preBeforePre.kind === ts.SyntaxKind.OpenParenToken) {
                    paramSyntax = pre
                } 
                break
            }
            preBeforePre = pre
            pre = item
        }
        const params = []
        if (paramSyntax) {
            for (let item of (paramSyntax as ts.SyntaxList).getChildren()) {
                if (item.kind === ts.SyntaxKind.Parameter) {
                    let paramName = null
                    for (let subItem of (item as ts.ParameterDeclaration).getChildren()) {
                        if (subItem.kind === ts.SyntaxKind.Identifier) {
                            paramName = subItem.getText()
                        }
                    }
                    if (paramName) {
                        const paramObj: IdentifierSyntax = {
                            name: paramName,
                            type: item.kind,
                            typeStr:ts.SyntaxKind[item.kind],
                            isExport: false,
                            isAsync: false,
                            text: item.getText()
                        }
                        params.push(paramObj)
                    }
                }
            }
            return params
        }
        return null
    }

    const parseParamsIntoSyntax = (node: ts.Node, syntax: IdentifierSyntax) => {
        syntax.param = getParamSyntax(node)
        if (syntax.param) {
            syntax.typeRef = getTypeRefInParam(node)
            if (syntax.typeRef!.length > 0) storeReferencedTypes(syntax.typeRef!)
        }
    }

    const analyzeNode = (node: ts.Node) => {
        if (node.kind === ts.SyntaxKind.SourceFile) {
            ts.forEachChild(node, analyzeNode)
            return
        }
        
        let name = '', 
            isAsync = false, 
            isExport = checkSyntaxType(node), 
            text = node.getText().replace(/export +/g, ''),
            syntax: IdentifierSyntax = { name, isAsync, isExport, type: node.kind, typeStr: ts.SyntaxKind[node.kind], text } 
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                for (let item of (node as ts.VariableStatement).declarationList.declarations) {
                    analyzeNode(item)
                }
                break
            case ts.SyntaxKind.ExportAssignment:
                // Export default
                throw 'export default is not supported'
            case ts.SyntaxKind.InterfaceDeclaration:
                syntax.name = (node as ts.InterfaceDeclaration).name.text
                break
            case ts.SyntaxKind.ClassDeclaration:
                syntax.name = (node as ts.ClassDeclaration).name!.text
                break
            case ts.SyntaxKind.ArrowFunction:
                syntax.name = (node as ts.ArrowFunction).name
                syntax.isAsync = checkSyntaxType(node, ts.SyntaxKind.AsyncKeyword)
                syntax.isExport = checkSyntaxType(node, ts.SyntaxKind.ExportKeyword)
                parseParamsIntoSyntax(node, syntax)
                break
            case ts.SyntaxKind.FunctionDeclaration:  case ts.SyntaxKind.FunctionExpression:
                syntax.name = (node as ts.FunctionDeclaration).name!.text
                syntax.isAsync = checkSyntaxType(node, ts.SyntaxKind.AsyncKeyword)
                syntax.isExport = checkSyntaxType(node, ts.SyntaxKind.ExportKeyword)
                parseParamsIntoSyntax(node, syntax)
                break
            case ts.SyntaxKind.VariableDeclaration:
                isExport = checkSyntaxType(node.parent.parent) // check the VariableStatement
                name = (node as ts.VariableDeclaration).name.getText()
                let isValueSyntax = false
                for (let item of (node as ts.VariableDeclaration).getChildren()) {
                    if (isValueSyntax) {
                        const sourceId = item.getText()
                        if (item.kind === ts.SyntaxKind.Identifier && idnetifiers.has(sourceId)) {
                            const tmpSyntax = Object.assign({}, idnetifiers.get(sourceId))
                            tmpSyntax!.name = name
                            tmpSyntax!.isExport = isExport
                            storeSyntax(tmpSyntax)
                        } else if (item.kind !== ts.SyntaxKind.Identifier) {
                            isAsync = checkSyntaxType(item, ts.SyntaxKind.AsyncKeyword)
                            const itemSyntax: IdentifierSyntax = { name, isAsync, isExport, type: item.kind, typeStr: ts.SyntaxKind[item.kind], text: sourceId}
                            if (item.kind === ts.SyntaxKind.FunctionExpression || item.kind === ts.SyntaxKind.ArrowFunction) {
                                parseParamsIntoSyntax(item, itemSyntax)
                            }
                            storeSyntax(itemSyntax)
                        }
                        isValueSyntax = false
                    } else if (item.kind === ts.SyntaxKind.FirstAssignment) {
                        isValueSyntax = true
                    }
                }
                break
            default:
                break;
        }
        storeSyntax(syntax)
    }

    analyzeNode(sourceFile)

    // filter out non-export items
    const iterator = idnetifiers.keys()
    let item = iterator.next()
    while (!item.done) {
        if (!(idnetifiers.get(item.value) as IdentifierSyntax).isExport) {
            idnetifiers.delete(item.value)
        }
        item = iterator.next()
    }

    return [idnetifiers, referencedTypes]
}

const processedFiles: {[key: string]: boolean} = {}
const sardineExtName = `.sardine.ts`

const processFile = (filePath: string) => {
    if (processedFiles[filePath]) return

    // recursively process directory
    if (fs.lstatSync(filePath).isDirectory()) {
        fs.readdirSync(filePath).forEach(item => {
            const subFilePath = path.join(filePath, `./${item}`)
            processFile(subFilePath)
        })
        processedFiles[filePath] = true
        return
    }

    // only process files, excluding socket/fifo/device files
    if (!fs.lstatSync(filePath).isFile()) return

    // Prepare the file names
    const dir = path.dirname(filePath)
    let baseName = path.basename(filePath)
    const extName = path.extname(baseName)

    if (extName.toLowerCase() !== '.ts') {
        const msg = `unsupported file type '${extName}' for file ${filePath}`
        if (params.verbose) {
            console.log(msg)
        }
        if (params.only_validate || params.validate) {
            throw msg
        }
    }

    // check if the file is source file
    let fileName = '',              // the pure file base name WITHOUT any extname nor the prefix dir path
        sardineFileName = '',       // ${fileName}.sardine
        sardineBaseName = '',       // ${sardineFileName}.ts
        sardineFilePath = '',       // file path like ${dir}/${sardineFileName}.ts
        intermediateFilePath = ''   // ${dir}/${sardineFileName}.tmp
    if (baseName.indexOf(sardineExtName) < 0) {
        fileName = path.basename(baseName, extName)
        sardineBaseName = `${fileName}${sardineExtName}`
        sardineFilePath = `${dir}/${sardineBaseName}`
    } else {
        sardineFilePath = filePath
        sardineBaseName = baseName
        fileName = path.basename(baseName, sardineExtName)
        filePath = `${dir}/${fileName}${extName}`
    }
    sardineFileName = path.basename(sardineBaseName, extName)
    intermediateFilePath = `${dir}/${sardineFileName}.tmp`

    // make sure no duplicated processing
    if (!params.recompile && !params.reverse) {
        if (fs.existsSync(sardineFilePath)) return
    } else if (fs.existsSync(sardineFilePath)) {
        fs.renameSync(sardineFilePath, filePath)
    }

    if (params.reverse) return

    let sourceFilePath = filePath

    if (params.verbose) {
        console.log(`processing file: ${sourceFilePath}`)
    }
    // compile it
    try {
        // process the source file
        // Parse a file
        const sourceFile = ts.createSourceFile(
            sourceFilePath,
            fs.readFileSync(sourceFilePath).toString(),
            ts.ScriptTarget.ES2015,
            /*setParentNodes */ true
        );
        const [identifiers, referencedTypes] = gatherExports(sourceFile);

        // generate compiled file to replace original file
        let line = `import * as origin from './${sardineFileName}'\n`
        if (!params.only_validate) {
            fs.writeFileSync(intermediateFilePath, line)
        }
        if (params.print) {
            console.log(line)
        }

        // import types referenced by source code
        for (let t of referencedTypes) {
            if (!identifiers.has(t)) {
                throw `source file need to export type reference '${t}'`
            } else {
                const line = `import { ${t} } from './${sardineFileName}'\n`
                if (!params.only_validate) {
                    fs.appendFileSync(intermediateFilePath, line)
                }
            }
        }

        const iterator = identifiers.keys()
        let key = iterator.next()
        while (!key.done) {
            const item: IdentifierSyntax = identifiers.get(key.value)!
            if (item.type === ts.SyntaxKind.InterfaceDeclaration) {
                line = `export { ${item.name} } from './${sardineFileName}'\n`
            } else {
                line = `export const ${item.name} = async (${item.param?item.param.map(x => x.text).join(', '):''}) => {\n` + 
                // TODO: generate service name
                // register service on the root node
                // check whether the service should run locally or remotely

                // run service locally
                `   return ${item.isAsync? 'await' : ''} origin.${item.name}(${item.param?item.param.map(x => x.name).join(', '):''})\n` +
                `}\n`
            }
            if (!params.only_validate) {
                fs.appendFileSync(intermediateFilePath, line)
            }
            if (params.print) {
                console.log(line)
            }
            key = iterator.next()
        }
        if (!params.only_validate && fs.existsSync(intermediateFilePath)) {
            if (params.verbose) {
                console.log(`renaming source file ${filePath} to sardine file ${sardineFilePath}`)
            }
            fs.renameSync(filePath, sardineFilePath)
            if (params.verbose) {
                console.log(`moving intermediate file ${intermediateFilePath} to replace source file ${filePath}`)
            }
            fs.renameSync(intermediateFilePath, filePath)
        }
        if (params.verbose || params.only_validate) {
            console.log(`successfully processed source file: ${sourceFilePath}\n`)
        }
    } catch (err) {
        if (params.verbose)  {
            console.error(`ERROR while processing ${filePath}:\n`, err, '\n')
        }
        if (params.validate || params.only_validate) {
            throw err
        }
    } finally {
        processedFiles[filePath] = true
        processedFiles[sardineFilePath] = true
        if (fs.existsSync(intermediateFilePath)) {
            fs.unlinkSync(intermediateFilePath)
        }
    }
}

files.forEach(filePath => {
    processFile(filePath)
});