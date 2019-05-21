// Read command line arguments

import * as proc from 'process'
// import * as utils from 'sardines-utils'

// Parse the arguments
const params: { [key: string]: any } = {}
const files: string[] = []

for (let i = 2; i < proc.argv.length; i++) {
    const item = proc.argv[i];
    if (item[0] === '-') {
        // is an argument
        const keyAndValue = item.replace(/-/g, '').split('=')
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

// Compiler 
// Reference: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
import { readFileSync } from "fs"
import * as ts from "typescript"

export function gatherExports(sourceFile: ts.SourceFile) {
    interface IdentifierSyntax { 
        name: string
        type: ts.SyntaxKind
        isExport: boolean
        text: string
    }
    const idnetifiers: Map<string, IdentifierSyntax> = new Map<string, IdentifierSyntax>()
    // const exportSyntexes: Array<{name: string, type: ts.SyntaxKind, text: string}> = new Array<{name: string, type: ts.SyntaxKind, text: string}>()

    const checkExportSyntax = (node: ts.Node):boolean => {
        if (node.kind === ts.SyntaxKind.ExportKeyword) return true
        let result = false
        if (node.getChildCount() > 0) {
            for (let child of node.getChildren()) {
                if (checkExportSyntax(child)) {
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
        }
        
        let name = '', syntax: IdentifierSyntax|null = null, isExport = checkExportSyntax(node), text = node.getText().replace(/export +/g, '')
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                for (let item of (node as ts.VariableStatement).declarationList.declarations) {
                    analyzeNode(item)
                }
                break
            case ts.SyntaxKind.ExportAssignment:
                // Export default
                break
            case ts.SyntaxKind.InterfaceDeclaration:
                name = (node as ts.InterfaceDeclaration).name.text
                syntax = { name, isExport, type: node.kind, text }
                break
            case ts.SyntaxKind.ClassDeclaration:
                name = (node as ts.ClassDeclaration).name!.text
                syntax = { name, isExport, type: node.kind, text}

                break
            case ts.SyntaxKind.FunctionDeclaration:
                name = (node as ts.FunctionDeclaration).name!.text
                syntax = { name, isExport, type: node.kind, text}
                break
            case ts.SyntaxKind.VariableDeclaration:
                name = (node as ts.VariableDeclaration).name.getText()
                let isValueSyntax = false
                for (let item of (node as ts.VariableDeclaration).getChildren()) {
                    if (isValueSyntax) {
                        const sourceId = item.getText()
                        if (item.kind === ts.SyntaxKind.Identifier && idnetifiers.has(sourceId)) {
                            const tmpSyntax = idnetifiers.get(sourceId)
                            tmpSyntax!.name = name
                            tmpSyntax!.isExport = isExport
                            idnetifiers.set(name, tmpSyntax!)
                        } else if (item.kind !== ts.SyntaxKind.Identifier) {
                            idnetifiers.set(name, { name, isExport, type: item.kind, text: sourceId})
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
        if (syntax) {
            idnetifiers.set(name, syntax!)
            // if (isExport(node)) exportSyntexes.push(syntax)
        }
    }

    analyzeNode(sourceFile);
    console.log(idnetifiers)
}

files.forEach(fileName => {
    // Parse a file
    const sourceFile = ts.createSourceFile(
        fileName,
        readFileSync(fileName).toString(),
        ts.ScriptTarget.ES2015,
    /*setParentNodes */ true
    );

    // delint it
    gatherExports(sourceFile);
});