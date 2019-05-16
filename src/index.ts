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

    analyzeNode(sourceFile);

    // const classes: string[] = []
    // const functions: string[] = []

    function analyzeNode(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.ExportKeyword) {
            // export something
            if (!node.parent) {
                console.log('      =>', ts.SyntaxKind[node.kind])
            }
            console.log(ts.SyntaxKind[node.parent.kind], node.parent.getText())
            analyzeExportClause(node.parent)
        } else if (node.kind === ts.SyntaxKind.ExportAssignment){
            // export default
            console.log('     ->', ts.SyntaxKind[node.kind])
            // if (node.kind === ts.SyntaxKind.VariableDeclaration) {
                for (let item of node.getChildren()) {
                    console.log(`  -- item kind: ${ts.SyntaxKind[item.kind]}, text: ${item.getText()}`)
                    if (item.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                        analyzeExportClause(item)
                    }
                }
            // }
        }
        ts.forEachChild(node, analyzeNode)
    }

    function analyzeExportClause(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                // console.log('================================')
                analyzeExportClause((node as ts.VariableStatement).declarationList)
                // break;
            case ts.SyntaxKind.VariableDeclarationList:
                // for (let child of (node as ts.VariableDeclarationList).declarations) {
                //     console.log('--------------------------------')
                //     console.log(`name: ${(child as ts.VariableDeclaration).name.getFullText()}`)
                //     console.log(`${ts.SyntaxKind[(child as ts.VariableDeclaration).getLastToken()!.kind]}`)
                //     for (let comp of (child as ts.VariableDeclaration).getChildren()) {
                //         console.log(`component type: ${ts.SyntaxKind[comp.kind]}, number of children: ${comp.getChildCount()}, text: ${comp.getFullText()}`)
                //     }
                // }
                // break
            case ts.SyntaxKind.ExportKeyword:
                // if (node.parent) {
                //     console.log('================================')
                //     console.log(`parent kind: ${ts.SyntaxKind[node.parent.kind]}, parent full text: ${node.parent.getFullText()}`)
                // }
                // break
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.SyntaxList:
            case ts.SyntaxKind.ObjectLiteralExpression:
            default:
                for (let item of node.getChildren()) {
                    console.log(    '---', ts.SyntaxKind[item.kind], item.getText())
                    // if (item.kind === ts.SyntaxKind.SyntaxList) {
                    if (item.getChildCount() > 1) {
                        analyzeExportClause(item)
                    }
                }
                break;
        }
    }
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