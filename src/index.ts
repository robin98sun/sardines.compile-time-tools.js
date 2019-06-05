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
import * as path from 'path'

import { gatherExports } from './parser'
import { transform } from './transformer'

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
        const [identifiers, referencedTypes, importedIds, proxyIds] = gatherExports(sourceFilePath);

        transform(sardineFileName, sourceFilePath, identifiers, referencedTypes, importedIds, proxyIds, (line:string, lineIndex:number) => {
            if (lineIndex === 0) {
                if (!params.only_validate) {
                    fs.writeFileSync(intermediateFilePath, line)
                }
                if (params.print) {
                    console.log(line)
                }
            } else if (line && !params.only_validate) {
                if (params.print) {
                    console.log(line)
                }
                fs.appendFileSync(intermediateFilePath, line)
            }
        })
        
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