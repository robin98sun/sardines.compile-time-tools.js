/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-06-25 15:12:48
 * @modify date 2019-06-25 15:12:48
 * @desc Checkout sardines branch and create a commit with git tags, 
 *          which are specified by the command line parameters, including:
 *          a custom tag
 *          a version tag
 *          if these parameters are omitted, then use default version tag
 *           and omit the custom tag
 *          Default version tag: start from 0.0.0, automatically increase 
 *           the miner version number, 
 *           others are mutable for custom version parameter
 */

import { spawn } from 'child_process'
import * as utils from 'sardines-utils'

interface ExecResult {
    stdout: string
    stderr: string
    code: number
}

const concatStrings = (cmdParts: string[]): string[] => {
    let result: string[] = []
    let inString = -1 
    for (let i=0; i<cmdParts.length;i++) {
        let p = cmdParts[i]
        if (inString < 0 && p[0] === '"' && p[p.length-1] !== '"') {
            inString = i
        } else if (inString >=0 && p[0] !== '"' && p[p.length-1] === '"') {
            result.push(cmdParts.slice(inString, i+1).join(' '))
            inString = -1
        } else if (inString < 0 && p.length > 0) {
            result.push(p)
        }
    }
    return result
}

export const exec = async (cmd: string, log: boolean = false): Promise<ExecResult> => {
    return new Promise((resolve, reject) => {
        if (!cmd) reject('command is empty')
        const cmdParts = cmd.split(' ')
        const programName = cmdParts.shift()

        // console.log(`executing command ${programName}, args:`, concatStrings(cmdParts))
        const p = spawn(programName!, concatStrings(cmdParts))
        let stdout = '', stderr = ''
        p.stdout.on('data', (data) => {
            if (log) console.log(data.toString())
            stdout += data.toString()
        })
        p.stderr.on('error', (e) => {
            if (log) console.error(e.toString())
            stderr += e.toString()
        })
        p.on('exit', (code) => {
            if (code === 0) {
                resolve({stdout, stderr, code})
            } else {
                reject({stdout, stderr, code})
            }
        })
    })
}

export const unifiedExec = async (params: {cmd: string, type?:string, subType?: string, msg?:string, verbose?: boolean}) => {
    const {cmd, type, subType, msg, verbose} = Object.assign({
        msg: '',
        verbose: false,
        type: 'sardines',
        subType: 'versioning'
    },params)
    try {
        const res = await exec(cmd)
        if (verbose) console.log(cmd)
        if (verbose) console.log(res.stdout)
        return res
    } catch (e) {
        if (verbose) console.error(`ERROR when executing command [${cmd}]:`, e)
        throw utils.unifyErrMesg(msg?msg:e, type, subType)
    }
}

export interface VersioningArguments {
    remote?: string
    branch?: string
    doCommit?: boolean
    tag?: string
    tagMsg?: string
    version?: string
    patch?: boolean
    minor?: boolean
    major?: boolean
    commit?: string
    verbose?: boolean
}

export interface Version {
    version: string
    tag: string
    branch: string
    git: string
    isNew?: boolean
}

