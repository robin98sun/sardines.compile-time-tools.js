import * as ts from "typescript"
import * as fs from 'fs'

const builtInTypes = ['Promise', 'Map', 'Array', 'Set', 'void', 'any', 'null', 'undefined', 'object', 'number', 'string', 'boolean']

export interface IdentifierSyntax { 
    name: string
    type: ts.SyntaxKind
    typeStr: string
    isExport: boolean
    isAsync: boolean
    text: string
    param?: IdentifierSyntax[]|null
    typeRef?: string[]
    returnType?: string
}

export const legalExportTypes = [
    ts.SyntaxKind.FunctionExpression, 
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.InterfaceDeclaration,
    ts.SyntaxKind.ObjectLiteralExpression,
    ts.SyntaxKind.ArrayLiteralExpression,
    ts.SyntaxKind.PropertyAccessExpression,
    ts.SyntaxKind.EnumDeclaration,
]

export const illegalExportTypes = [
    ts.SyntaxKind.ClassDeclaration,
]

export function gatherExports(sourceFilePath: string): [Map<string, IdentifierSyntax>, string[], string[], string[]] {
    const sourceFile = ts.createSourceFile(
        sourceFilePath,
        fs.readFileSync(sourceFilePath).toString(),
        ts.ScriptTarget.ES2015,
        /*setParentNodes */ true
    );
    const idnetifiers: Map<string, IdentifierSyntax> = new Map<string, IdentifierSyntax>()
    const referencedTypes: string[] = []
    const importedIds: string[] = []
    const proxyIds: string[] = []

    
    const storeSyntax = (syntax: IdentifierSyntax) => {
        if (syntax.name) {
            if (idnetifiers.has(syntax.name)) {
                throw `duplicated identifier: ${syntax.name}`
            } else  if (syntax.isExport && illegalExportTypes.indexOf(syntax.type) >= 0) {
                throw `illegal export type: ${ts.SyntaxKind[syntax.type]} for syntax [${syntax.name}]`
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

    const storeImportedOrExportedIds = (ids: string[], source:string|null, isImport:boolean = true) => {
        if (!source) return
        for (let item of ids) {
            let line = `${item}|${source}`
            if (isImport && importedIds.indexOf(line) < 0) importedIds.push(line)
            else if (!isImport && proxyIds.indexOf(line) < 0) proxyIds.push(line)
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

    const printNode = (node: ts.Node, prefix: string = '') => {
        console.log(prefix, ts.SyntaxKind[node.kind], node.getText())
        for (let item of node.getChildren()){
            printNode(item, prefix + '    ')
        }
    }

    const getTypeRefInParam = (param: ts.Node): string[] => {
        const result = []
        for (let item of param.getChildren()) {
            let digIn = true 
            if (item.kind === ts.SyntaxKind.TypeReference) {
                let text = item.getText()
                if (text.indexOf('<') < 0 && builtInTypes.indexOf(text) < 0 && text.indexOf('|') < 0) {
                    result.push(text)
                    digIn = false
                } 
            } 
            if (digIn) {
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

    const getReturnType = (node: ts.Node) => {
        let preBeforePre = null, pre = null, returnType = null
        for (let child of node.getChildren()) {
            if (pre && preBeforePre && preBeforePre.kind === ts.SyntaxKind.ColonToken) 
                if (child.kind === ts.SyntaxKind.EqualsGreaterThanToken || child.kind === ts.SyntaxKind.Block) {
                    returnType = pre.getText()
                }
            preBeforePre = pre
            pre = child
        }
        return returnType
    }

    const parseParamsIntoSyntax = (node: ts.Node, syntax: IdentifierSyntax) => {
        syntax.param = getParamSyntax(node)
        if (syntax.param) {
            syntax.typeRef = getTypeRefInParam(node)
            if (syntax.typeRef!.length > 0) storeReferencedTypes(syntax.typeRef!)
        }
        syntax.isAsync = checkSyntaxType(node, ts.SyntaxKind.AsyncKeyword)
        let returnType = getReturnType(node)
        if (!returnType) returnType = 'any'
        else if (syntax.isAsync && returnType.indexOf('Promise<') === 0) {
            returnType = returnType.substr(8)
            returnType = returnType.substr(0, returnType.length - 1)
        }
        syntax.returnType = returnType
        return syntax
    }

    const getNamedImportsOrExports = (node: ts.Node): [string[], string|null] => {
        const importedOrExportedIds: string[] = []
        let source = null, isSource = false
        for (let item of node.getChildren()) {
            if (item.kind === ts.SyntaxKind.ImportSpecifier || item.kind === ts.SyntaxKind.ExportSpecifier) {
                const children = item.getChildren()
                if (children.length ===1) {
                    importedOrExportedIds.push(children[0].getText())
                } else if (children.length === 3 && children[1].kind === ts.SyntaxKind.AsKeyword) {
                    importedOrExportedIds.push(children[0].getText() + ':' + children[2].getText())
                }
            } else if (item.kind === ts.SyntaxKind.FromKeyword) {
                isSource = true
            } else if (item.kind === ts.SyntaxKind.StringLiteral && isSource) {
                source = item.getText()
            } else {
                const [subIds, subSource] = getNamedImportsOrExports(item)
                for (let subId of subIds) {
                    if (importedOrExportedIds.indexOf(subId) < 0) importedOrExportedIds.push(subId)
                }
                if (subSource) {
                    if (!source) source = subSource
                }
            }
        }
        return [importedOrExportedIds, source]
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
        // DEBUG
        // if (node.getText().indexOf('StorageType') >=0 && node.kind === ts.SyntaxKind.VariableDeclaration) {
        //     console.log('======================')
        //     console.log('node kind:', ts.SyntaxKind[node.kind])
        //     printNode(node)
        //     console.log('======================')
        //     console.log('isExport:', isExport)
        //     console.log('======================')
        // }
        // DEBUG
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                for (let item of (node as ts.VariableStatement).declarationList.declarations) {
                    analyzeNode(item)
                }
                break
            case ts.SyntaxKind.ExportDeclaration: case ts.SyntaxKind.ImportDeclaration:
                let [importedIds, source] = getNamedImportsOrExports(node)
                    storeImportedOrExportedIds(importedIds, source, node.kind === ts.SyntaxKind.ImportDeclaration)
                break
            case ts.SyntaxKind.ExportAssignment:
                // Export default
                throw 'export default is not supported'
            case ts.SyntaxKind.InterfaceDeclaration:
                syntax.name = (node as ts.InterfaceDeclaration).name.text
                break
            case ts.SyntaxKind.EnumDeclaration:
                syntax.name = (node as ts.EnumDeclaration).name.text
                break
            case ts.SyntaxKind.ClassDeclaration:
                syntax.name = (node as ts.ClassDeclaration).name!.text
                break
            case ts.SyntaxKind.ArrowFunction:
                syntax.name = (node as ts.ArrowFunction).name
                syntax.isExport = checkSyntaxType(node, ts.SyntaxKind.ExportKeyword)
                parseParamsIntoSyntax(node, syntax)
                break
            case ts.SyntaxKind.FunctionDeclaration:  case ts.SyntaxKind.FunctionExpression:
                syntax.name = (node as ts.FunctionDeclaration).name!.text
                syntax.isExport = checkSyntaxType(node, ts.SyntaxKind.ExportKeyword)
                parseParamsIntoSyntax(node, syntax)
                break
            case ts.SyntaxKind.VariableDeclaration:
                isExport = checkSyntaxType(node.parent.parent) // check the VariableStatement
                name = (node as ts.VariableDeclaration).name.getText()
                let isValueSyntax = false
                for (let item of (node as ts.VariableDeclaration).getChildren()) {
                    if (isValueSyntax) {
                        // DEBUG
                        // if (node.getText().indexOf('StorageType') >=0 && node.kind === ts.SyntaxKind.VariableDeclaration) {
                        //     console.log('======================')
                        //     console.log(ts.SyntaxKind[node.kind])
                        //     printNode(node)
                        //     console.log('======================')
                        //     console.log('isExport:', isExport, ', name:', name, ', itemSyntax:')
                        //     console.log('======================')
                        // }
                        // DEBU
                        const sourceId = item.getText()
                        if (item.kind === ts.SyntaxKind.Identifier && idnetifiers.has(sourceId)) {
                            const tmpSyntax = Object.assign({}, idnetifiers.get(sourceId))
                            tmpSyntax!.name = name
                            tmpSyntax!.isExport = isExport
                            storeSyntax(tmpSyntax)
                        } else if (item.kind !== ts.SyntaxKind.Identifier) {
                            const itemSyntax: IdentifierSyntax = { name, isAsync: false, isExport, type: item.kind, typeStr: ts.SyntaxKind[item.kind], text: sourceId}
                            if (item.kind === ts.SyntaxKind.FunctionExpression || item.kind === ts.SyntaxKind.ArrowFunction) {
                                parseParamsIntoSyntax(item, itemSyntax)
                            }
                            // some variables do not have handler, but could be stored as syntax
                            // console.log('b tmp syntax:', itemSyntax)
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
        const idenObj = <IdentifierSyntax>(idnetifiers.get(item.value))
        if (!idenObj.isExport 
            || legalExportTypes.indexOf(idenObj.type)<0) {
            idnetifiers.delete(item.value)
        }
        item = iterator.next()
    }
    return [idnetifiers, referencedTypes, importedIds, proxyIds]
}