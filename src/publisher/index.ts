// import * as utils from 'sardines-utils'
import * as npm from 'npm'
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

export const signUpRepository = async(repoUrl: string, username: string, password: string) => {
    if (!repoUrl) throw utils.unifyErrMesg('repository url is missing', 'sardines', 'publisher')
    if (!username) throw utils.unifyErrMesg('repository username is missing', 'sardines', 'publisher')
    if (!password) throw utils.unifyErrMesg('repository password is missing', 'sardines', 'publisher')
    let res:any = await fetch(`${repoUrl}/repository/signUp`, {
        method: 'put',
        body: JSON.stringify({ account: { name: username }, password }),
        headers: { 'content-type': 'application/json'}
    })
    try {
        res = await res.text()
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher sign up')
    }
}

export const loginRepository = async(repoUrl: string, username: string, password: string) => {
    if (!repoUrl) throw utils.unifyErrMesg('repository url is missing', 'sardines', 'publisher')
    if (!username) throw utils.unifyErrMesg('repository username is missing', 'sardines', 'publisher')
    if (!password) throw utils.unifyErrMesg('repository password is missing', 'sardines', 'publisher')
    let res:any = await fetch(`${repoUrl}/repository/signIn`, {
        method: 'put',
        body: JSON.stringify({ account: { name: username }, password }),
        headers: { 'content-type': 'application/json'}
    })
    try {
        res = await res.text()
        return res
    } catch (e) {
        throw utils.unifyErrMesg(e, 'sardines', 'publisher login')
    }
}

export interface RepositoryAuth {
    url: string
    username: string
    password: string
}

export const publish = async (repo: RepositoryAuth) => {
    let token: any = ''
    try {
        token = await loginRepository(repo.url, repo.username, repo.password)
        if (token && typeof token === 'object' && token.error) {
            console.log(token)
            token = await signUpRepository(repo.url, repo.username, repo.password)
            if (token && typeof token === 'object' && token.error){
                throw token
            }
        } 
        console.log('token:', token)
    } catch (e) {
        console.log('ERROR when trying to login register:', e)
    }
}
