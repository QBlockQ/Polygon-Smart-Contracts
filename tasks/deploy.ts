import { task } from 'hardhat/config'
import { TASKS } from './task-names'
import { string } from 'hardhat/internal/core/params/argumentTypes'
import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { verifyStorageLayout, ReleaseRegistry, DeployFunction, loadSolcBinary, getStorageLayout, contractsPaths } from '../lib'

task(TASKS.DEPLOY, 'runs a deployment')
  .addParam('contract', 'Contract to deploy', 'generic', string)
  .addOptionalParam('params', 'Comma separated list of constructor parameters', '', string)
  .setAction(async function(args, { artifacts, network, web3, config, run }) {
    const { contract, params } = args

    const contractPaths = await contractsPaths(artifacts)
    // TODO need to support multiple versions of the compiler
    const compiler = await loadSolcBinary(config.solidity.compilers.map(x => x.version)[0])

    const fileContent = await run(TASK_FLATTEN_GET_FLATTENED_SOURCE, {files: [contractPaths[contract]]})
    const registry = new ReleaseRegistry(network.name)
    await registry.createNewRelease()

    try {
      await verifyStorageLayout(registry, contract, fileContent, compiler)
      registry.replaceStorageLayout(
        contract,
        await getStorageLayout(contract, fileContent, compiler)
      )
    } catch (exc) {
      console.error(exc)
      throw exc
    }

    const deploy = require(`../migrations/${contract}`).deploy as DeployFunction
    const deployedAddress = await deploy(artifacts, network.name, web3.defaultAccount, params)
    registry.replaceAddress(contract, deployedAddress)

    await registry.save()
  })