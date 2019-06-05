import * as ts from "typescript"
import * as fs from 'fs'

export interface IdentifierSyntax { 
    name: string
    type: ts.SyntaxKind
    typeStr: string
    isExport: boolean
    isAsync: boolean
    text: string
    param?: IdentifierSyntax[]|null
    typeRef?: string[]
}

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

    return [idnetifiers, referencedTypes, importedIds, proxyIds]
}