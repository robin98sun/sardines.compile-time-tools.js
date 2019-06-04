import * as origin from './correct.sardine'
export { ServiceSettings } from './correct.sardine'
export { ServiceIdentity } from './correct.sardine'
export { RepositorySettings } from './correct.sardine'
export const someFunc = async (...params: any[]) => {
   return await origin.someFunc(...params)
}
export const someArrowFunc = async (...params: any[]) => {
   return await origin.someArrowFunc(...params)
}
export const x = async (...params: any[]) => {
   return  origin.x(...params)
}
export const z = async (...params: any[]) => {
   return await origin.z(...params)
}
