export { compile } from './compiler'
export { npmCmd } from './publisher'

import {
    publish
} from './publisher'

publish({
    url: 'http://localhost:8080',
    username: 'dietitian-dev',
    password: 'Startup@2019'
})