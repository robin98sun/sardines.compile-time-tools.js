import { Sardines } from 'sardines-core'

export const setupRepo = (sardinesConfig: Sardines.Config, writeline: any) => {
  writeline(`import { RepositoryClient } from 'sardines-core'`)
  writeline(`export const sardinesConfig = ${JSON.stringify(sardinesConfig, null, 2)}`)
  writeline(`RepositoryClient.setupRepositoryEntriesBySardinesConfig(sardinesConfig)`)
  writeline(`RepositoryClient.setupDrivers(drivers)`)
}
