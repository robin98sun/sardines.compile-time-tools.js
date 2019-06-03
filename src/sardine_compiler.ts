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
}

export function gatherExports(sourceFile: ts.SourceFile): Map<string, IdentifierSyntax> {
    
    const idnetifiers: Map<string, IdentifierSyntax> = new Map<string, IdentifierSyntax>()

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

    const analyzeNode = (node: ts.Node) => {
        if (node.kind === ts.SyntaxKind.SourceFile) {
            ts.forEachChild(node, analyzeNode)
            return
        }
        
        let name = '', 
            isAsync = false, 
            isExport = checkSyntaxType(node), 
            text = node.getText().replace(/export +/g, ''),
            syntax = { name, isAsync, isExport, type: node.kind, typeStr: ts.SyntaxKind[node.kind], text }
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
                syntax.isExport = checkSyntaxType(node, ts.SyntaxKind.AsyncKeyword)
                break
            case ts.SyntaxKind.FunctionDeclaration:
                syntax.name = (node as ts.FunctionDeclaration).name!.text
                syntax.isAsync = checkSyntaxType(node, ts.SyntaxKind.AsyncKeyword)
                syntax.isExport = checkSyntaxType(node, ts.SyntaxKind.AsyncKeyword)
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
                            storeSyntax({ name, isAsync, isExport, type: item.kind, typeStr: ts.SyntaxKind[item.kind], text: sourceId})
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
    return idnetifiers
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
        throw `unsupported file type: ${extName}`
    }

    // check if the file is source file
    let fileName = '', sardineBaseName = '', sardineFilePath = ''
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
    const sardineFileName = path.basename(sardineBaseName, extName)

    // make sure no duplicated processing
    if (fs.existsSync(sardineFilePath) && processedFiles[sardineFilePath]) return
    if (fs.existsSync(filePath) && processedFiles[filePath]) return

    let sourceFilePath = sardineFilePath
    if (params['no-moving']) {
        sourceFilePath = filePath
    } else if (!fs.existsSync(sardineFilePath)) {
        fs.renameSync(filePath, sardineFilePath)
        if (params['verbose']) {
            console.log(`moving ${filePath} to ${sardineFilePath}`)
        }
    }

    if (fs.existsSync(sourceFilePath) && processedFiles[sourceFilePath]) return

    if (params['verbose']) {
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
        const identifiers = gatherExports(sourceFile);

        // generate compiled file to replace original file
        let line = `import * as origin from './${sardineFileName}'\n`
        if (!params['no-moving']) {
            fs.writeFileSync(filePath, line)
        }
        if (params['verbose']) {
            console.log(line)
        }

        const iterator = identifiers.keys()
        let key = iterator.next()
        while (!key.done) {
            const item: IdentifierSyntax = identifiers.get(key.value)!
            if (item.type === ts.SyntaxKind.InterfaceDeclaration) {
                line = `export ${item.text}`
            } else {
                line = `export const ${item.name} = async (...params) => {\n` + 
                // TODO: generate service name
                // register service on the root node
                // check whether the service should run locally or remotely

                // run service locally
                `   return ${item.isAsync? 'await' : ''} origin.${item.name}(...params)\n` +
                `}`
            }
            if (!params['no-moving']) {
                fs.appendFileSync(filePath, line)
            }
            if (params['verbose']) {
                console.log(line)
            }
            key = iterator.next()
        }
        if (params['verbose']) {
            console.log(`successfully processed source file: ${sourceFilePath}\n`)
        }
    } catch (err) {
        if (params['verbose']) {
            console.error(`ERROR while processing ${filePath}:\n`, err, '\n')
        }
    } finally {
        processedFiles[filePath] = true
        processedFiles[sardineFilePath] = true
    }
}

files.forEach(filePath => {
    processFile(filePath)
});