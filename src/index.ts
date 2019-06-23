/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-06-21 14:19:18
 * @modify date 2019-06-21 14:19:18
 * @desc [description]
 */
// Compiler 
// Reference: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
import * as fs from "fs"
import * as path from 'path'

import { gatherExports } from './parser'
import { transform, Service, getServiceName } from './transformer'

export const compile = async (compilerSettings: any, targetFiles: string[]) => {
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
                    if (compilerSettings.validate || compilerSettings.only_validate) {
                        error = subjobResult.error
                        filePath = subjobResult.filePath
                        break
                    }
                    if (compilerSettings.verbose) {
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
    
        if (!compilerSettings.recompile && !compilerSettings.reverse) {
            if (fs.existsSync(sardineFilePath)) return {services,error,filePath}
        } else if (fs.existsSync(sardineFilePath)) {
            if (compilerSettings.verbose) {
                console.log(`restoring source file ${filePath} from sardine file ${sardineFilePath}`)
            }
            fs.renameSync(sardineFilePath, filePath)
        }
    
        if (compilerSettings.reverse) return {services,error,filePath}
        
        if (targetFilePath === sardineFilePath) return {services,error,filePath}
    
        let sourceFilePath = filePath
    
        if (processedFiles[filePath]) return {services,error,filePath}
        processedFiles[filePath] = true
    
        if (compilerSettings.verbose) {
            console.log(`processing file: ${sourceFilePath}`)
        }
        
        // compile it
        try {
            // process the source file
            // Parse a file
            const [identifiers, referencedTypes, importedIds, proxyIds] = gatherExports(sourceFilePath);
    
            services = await transform(fileName, sardineFileName, sourceFilePath, identifiers, referencedTypes, importedIds, proxyIds, (line:string, lineIndex:number) => {
                if (lineIndex === 0) {
                    if (!compilerSettings.only_validate) {
                        fs.writeFileSync(intermediateFilePath, line)
                    }
                    if (compilerSettings.print) {
                        console.log(line)
                    }
                } else if (line && !compilerSettings.only_validate) {
                    if (compilerSettings.print) {
                        console.log(line)
                    }
                    fs.appendFileSync(intermediateFilePath, line)
                }
            })
    
            // 
            if (!compilerSettings.only_validate && fs.existsSync(intermediateFilePath)) {
                if (compilerSettings.verbose) {
                    console.log(`renaming source file ${filePath} to sardine file ${sardineFilePath}`)
                }
                fs.renameSync(filePath, sardineFilePath)
                if (compilerSettings.verbose) {
                    console.log(`moving intermediate file ${intermediateFilePath} to replace source file ${filePath}`)
                }
                fs.renameSync(intermediateFilePath, filePath)
            }
            if (compilerSettings.verbose || compilerSettings.only_validate) {
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
    if (compilerSettings.gen_services) {
        if (fs.existsSync(compilerSettings.gen_services)) {
            try {
                service_definition_file_content = JSON.parse(fs.readFileSync(compilerSettings.gen_services).toString())
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
                if (compilerSettings.verbose) {
                    console.error(`error when loading service definition file at [${compilerSettings.gen_services}]:`, e, '\n')
                }
            }
        } else {
            sardineServices = new Map()
            service_definition_file_content.services = []
        }
    }
    
    Promise.all(targetFiles.map(filePath => processFile(filePath))).then(results => {
        let hasError = false
        for (let {services, error, filePath} of <JobResult[]>results) {
            if (error) {
                hasError = true
                if (compilerSettings.verbose || compilerSettings.only_validate || compilerSettings.validate)  {
                    console.error(`ERROR while processing ${filePath}:`, error, '\n')
                }
            } else if(sardineServices) {
                for (let s of services) {
                    const name = getServiceName(s)
                    sardineServices.set(name, s)
                }
            }
        }
        if (!hasError && !compilerSettings.only_validate && sardineServices) {
            if (compilerSettings.gen_services && Array.isArray(service_definition_file_content.services)) {
                service_definition_file_content.services = Array.from(sardineServices.values())
                if (compilerSettings.application) {
                    service_definition_file_content.application = compilerSettings.application
                }
                try {
                    fs.writeFileSync(compilerSettings.gen_services, JSON.stringify(service_definition_file_content, null, 4))
                    if (compilerSettings.verbose) {
                        console.log(`${service_definition_file_content.services.length} services stored in the sardine definition file at [${compilerSettings.gen_services}]`)
                    }
                } catch (e) {
                    console.error(`ERROR when writing sardine service definition file at [${compilerSettings.gen_services}]`, e, '\n')
                }
            }
        }
        return sardineServices
    }).catch(e => {
        console.error('UNKNOW ERROR:', e, '\n')
    })
}
