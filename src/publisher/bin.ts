import * as utils from 'sardines-utils'
import { publish } from './index'

let {params} = utils.parseArgs()
if (params.test) {
    publish({
        url: 'http://localhost:8080',
        username: 'dietitian-dev',
        password: 'Startup@2019'
    })
}