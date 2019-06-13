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

if (params['gen-services']) {
    let paramValue = params['gen-services']
    if (typeof paramValue === 'string'){
        if(params.verbose) console.log(`going to generate service definition file at [${paramValue}]`)
    } else {
        paramValue = `${proc.cwd()}/sardines.json`
        if(params.verbose) console.log(`going to generate service definition file at [${paramValue}]`)
    }
    params.gen_services = paramValue
}


// Compiler 
// Reference: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
import * as fs from "fs"
import * as path from 'path'

import { gatherExports } from './parser'
import { transform, Service, getServiceName } from './transformer'

const processedFiles: {[key: string]: boolean} = {}
const sardineExtName = `.sardine.ts`

interface JobResult {
    services: Service[]
    error: any|null
    filePath: string
}

const processFile = async (targetFilePath: string): Promise<JobResult> => {
    let services: Service[] = []
    let filePath = targetFilePath
    let error = null

    if (processedFiles[filePath]) return {services,error,filePath}

    // recursively process directory
    if (fs.lstatSync(filePath).isDirectory()) {
        for(let item of fs.readdirSync(filePath)) {
            const subFilePath = path.join(filePath, `./${item}`)
            let subjobResult = await processFile(subFilePath)
            if (subjobResult.error) {
                if (params.validate || params.only_validate) {
                    error = subjobResult.error
                    filePath = subjobResult.filePath
                    break
                }
                if (params.verbose) {
                    console.error(`ERROR for file ${subjobResult.filePath}:`, subjobResult.error, '\n')
                }
            } else {
                Array.prototype.push.apply(services, subjobResult.services)
            }
        }
        processedFiles[filePath] = true
        return {services,error,filePath}
    }

    // only process files, excluding socket/fifo/device files
    if (!fs.lstatSync(filePath).isFile()) return {services,error,filePath}

    // Prepare the file names
    const dir = path.dirname(filePath)
    let baseName = path.basename(filePath)
    const extName = path.extname(baseName)

    if (extName.toLowerCase() !== '.ts') {
        error = `unsupported file type '${extName}' for file ${filePath}`
        return {services,error,filePath}
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
        if (fs.existsSync(sardineFilePath)) return {services,error,filePath}
    } else if (fs.existsSync(sardineFilePath)) {
        if (params.verbose) {
            console.log(`restoring source file ${filePath} from sardine file ${sardineFilePath}`)
        }
        fs.renameSync(sardineFilePath, filePath)
    }

    if (params.reverse) return {services,error,filePath}
    
    if (targetFilePath === sardineFilePath) return {services,error,filePath}

    let sourceFilePath = filePath

    if (processedFiles[filePath]) return {services,error,filePath}
    processedFiles[filePath] = true

    if (params.verbose) {
        console.log(`processing file: ${sourceFilePath}`)
    }
    
    // compile it
    try {
        // process the source file
        // Parse a file
        const [identifiers, referencedTypes, importedIds, proxyIds] = gatherExports(sourceFilePath);

        services = await transform(fileName, sardineFileName, sourceFilePath, identifiers, referencedTypes, importedIds, proxyIds, (line:string, lineIndex:number) => {
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

        // 
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
        return {services,error,filePath}
    } catch (err) {
        error = err
    } finally {
        if (fs.existsSync(intermediateFilePath)) {
            fs.unlinkSync(intermediateFilePath)
        }
        return {services,error,filePath}
    }
}


// Prepare service definition file
let service_definition_file_content: any = {}
let sardineServices: Map<string, Service>|null = null
if (params.gen_services) {
    if (fs.existsSync(params.gen_services)) {
        try {
            service_definition_file_content = JSON.parse(fs.readFileSync(params.gen_services).toString())
            if (service_definition_file_content.services) {
                sardineServices = new Map()
                for (let s of service_definition_file_content.services) {
                    const name = getServiceName(s)
                    if (!sardineServices.has(name)) {
                        sardineServices.set(name, s)
                    }
                }
                service_definition_file_content.services = []
            }
        } catch(e) {
            if (params.verbose) {
                console.error(`error when loading service definition file at [${params.gen_services}]:`, e, '\n')
            }
        }
    } else {
        sardineServices = new Map()
        service_definition_file_content.services = []
    }
}

Promise.all(files.map(filePath => processFile(filePath))).then(results => {
    let hasError = false
    for (let {services, error, filePath} of <JobResult[]>results) {
        if (error) {
            hasError = true
            if (params.verbose || params.only_validate || params.validate)  {
                console.error(`ERROR while processing ${filePath}:`, error, '\n')
            }
        } else if(sardineServices) {
            for (let s of services) {
                const name = getServiceName(s)
                sardineServices.set(name, s)
            }
        }
    }
    if (!hasError && !params.only_validate && params.gen_services && Array.isArray(service_definition_file_content.services) && sardineServices) {
        service_definition_file_content.services = Array.from(sardineServices.values())
        try {
            fs.writeFileSync(params.gen_services, JSON.stringify(service_definition_file_content, null, 4))
            if (params.verbose) {
                console.log(`${service_definition_file_content.services.length} services stored in the sardine definition file at [${params.gen_services}]`)
            }
        } catch (e) {
            console.error(`ERROR when writing sardine service definition file at [${params.gen_services}]`, e, '\n')
        }
    }
}).catch(e => {
    console.error('UNKNOW ERROR:', e, '\n')
})