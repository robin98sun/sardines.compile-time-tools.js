/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-02 11:51:54
 * @modify date 2019-08-02 11:51:54
 * @desc [description]
 */

import * as npm from 'npm'
import { Sardines } from 'sardines-core'
import { utils } from 'sardines-core'
import * as fs from 'fs' 
import * as path from 'path'

export namespace Source {
    let npmInst: any = null
    export const npmCmd = (command: string, args: string[]) => {
        return new Promise((resolve, reject) => {
            const cmd = () => {
                (<{[key: string]: any}>(npmInst.commands))[command](args, (err:any, data: any) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(data)
                    }
                })
            }
            if (!npmInst) {
                npm.load((err, inst) => {
                    if (err) reject(err)
                    else {
                        // console.log('npm load data:', data)
                        npmInst = inst
                        cmd()
                    }
                })
            } else {
                cmd()
            }
        })
    }

    export const requirePackage = async (packName: string) => {
        const packageDir = path.resolve(`node_modules/${packName}`)
        if (!fs.existsSync(packageDir)) {
            throw `Can not access package [${packName}] directory at [${packageDir}]`
        }
        const packageConfigFile = path.resolve(`${packageDir}/package.json`)
        if (!fs.existsSync(packageConfigFile)) {
            throw `Can not access package.json file for package [${packName}] at [${packageConfigFile}]`
        }
        let packageConfig: any = null
        try {
            packageConfig = JSON.parse(fs.readFileSync(packageConfigFile).toString())
            if (!packageConfig) throw ''
        } catch (e) {
            throw `Can not parse package.json file for package [${packName}]`
        }
        if (packageConfig && !packageConfig.main) {
            throw `Invalid package.json file for package [${packName}]`
        }
        const mainFileName = packageConfig.main
        const mainFilePath = path.resolve(`${packageDir}/${mainFileName}`)
        if (!fs.existsSync(mainFilePath)) {
            throw `Can not access entrance file for package [${packName}] at [${mainFilePath}]`
        }
        const packageInst: any = require(mainFilePath)
        return packageInst
    }
    
    export const getPackageFromNpm = async (packName: string, locationType: Sardines.LocationType, verbose: boolean = false ) =>  {
        // check whether the package has been loaded already
        if (!fs.existsSync(`node_modules/${packName}`)) {
            // load the package if needed
            try {
                const type = locationType || Sardines.LocationType.npm
                switch (type) {
                case Sardines.LocationType.npm:
                    if (verbose) {
                        console.log('going to install package:', packName)
                    }
                    await npmCmd('install', [packName])
                    if (verbose) {
                        console.log('package:', packName, 'installed')
                    }
                    break
                case Sardines.LocationType.npm_link:
                    if (verbose) {
                        console.log('going to link package:', packName)
                    }
                    await npmCmd('link', [packName])
                    if (verbose) {
                        console.log('package:', packName, 'linked')
                    }
                    break
                case Sardines.LocationType.file:
                    break
                default:
                    break
                }
            } catch (e) {
                if (verbose) {
                    console.error(`ERROR when downloading npm package [${packName}]`)
                }
                throw utils.unifyErrMesg(`Error when downloading npm package [${packName}]: ${e}`, 'sourcing', 'npm')
            }
        }

        try {
            const packageInst:any = requirePackage(packName)
            if (packageInst && packageInst.default) return packageInst.default
            else if (packageInst) return packageInst
            else return null
        } catch (e) {
            if (verbose) {
                console.error(`ERROR when importing npm package [${packName}]`)
            }
            throw utils.unifyErrMesg(`Error when importing npm package [${packName}]: ${e}`, 'sourcing', 'npm')
        }
    }
}
