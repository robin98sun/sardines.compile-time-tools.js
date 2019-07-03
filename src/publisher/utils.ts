import * as npm from 'npm'
// import * as fs from 'fs'
import fetch from 'node-fetch'
import * as utils from 'sardines-utils'
// import {Version, VersioningArguments, versioning} from '../versioning'

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

export const loginRepository = async(repoUrl: string, username: string, password: string) => {
    if (!repoUrl) throw utils.unifyErrMesg('repository url is missing', 'sardines', 'publisher')
    if (!username) throw utils.unifyErrMesg('repository username is missing', 'sardines', 'publisher')
    if (!password) throw utils.unifyErrMesg('repository password is missing', 'sardines', 'publisher')
    try {
        let res:any = await fetch(`${repoUrl}/repository/signIn`, {
            method: 'put',
            body: JSON.stringify({ account: { name: username }, password }),
            headers: { 'content-type': 'application/json'}
        })
        res = await res.text()
        if (res && res.indexOf('error')>0) {
            res = JSON.parse(res)
        }
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher login')
    }
}

export const signUpRepository = async(repoUrl: string, username: string, password: string) => {
    if (!repoUrl) throw utils.unifyErrMesg('repository url is missing', 'sardines', 'publisher')
    if (!username) throw utils.unifyErrMesg('repository username is missing', 'sardines', 'publisher')
    if (!password) throw utils.unifyErrMesg('repository password is missing', 'sardines', 'publisher')
    try {
        let res:any = await fetch(`${repoUrl}/repository/signUp`, {
            method: 'put',
            body: JSON.stringify({ account: { name: username }, password }),
            headers: { 'content-type': 'application/json'}
        })
        res = await res.text()
        if (res && res.indexOf('error')>0) {
            res = JSON.parse(res)
            throw res
        } 
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher sign up')
    }
}

export const createOrUpdateSource = async(repoUrl: string, source: any, token: string) => {
    try {
        let res:any = await fetch(`${repoUrl}/repository/createOrUpdateSource`, {
            method: 'POST',
            body: JSON.stringify({ source, token }),
            headers: { 'content-type': 'application/json'}
        })
        res = await res.text()
        res = JSON.parse(res)
        if (res && res.error) {
            throw res
        } 
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher update source info')
    }
}

export const createOrUpdateApplication = async(repoUrl: string, application: any, token: string) => {
    try {
        let res:any = await fetch(`${repoUrl}/repository/createOrUpdateApplication`, {
        method: 'POST',
        body: JSON.stringify({ application, token }),
        headers: { 'content-type': 'application/json'}
    })
        res = await res.text()
        res = JSON.parse(res)
        if (res && res.error) {
            throw res
        } 
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher update application info')
    }
}

export const createOrUpdateService = async(repoUrl: string, service: any, token: string) => {
    try {
        let res:any = await fetch(`${repoUrl}/repository/createOrUpdateService`, {
            method: 'POST',
            body: JSON.stringify({ service, token }),
            headers: { 'content-type': 'application/json'}
        })
        res = await res.text()
        res = JSON.parse(res)
        if (res && res.error) {
            throw res
        } 
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher update service info')
    }
}