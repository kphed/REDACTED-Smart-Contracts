import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BTRFLY, Distributor, REDACTEDStaking, StakingWarmup, XBTRFLY } from '../typechain'
import {
  BTRFLY_ADDRESS,
  DISTRIBUTOR_ADDRESS,
  NEW_XBTRFLY_ADDRESS,
  STAKING_ADDRESS,
  TREASURY_MANAGER,
} from './constants'
import { deployStaking, deployWarmup, deployXbtrfly } from './ProtocolDeployment'
import { mineBlocks } from './utils'

export const impersonateAddressAndReturnSigner = async (
  networkAdmin: SignerWithAddress,
  address: string,
) => {
  await ethers.provider.send('hardhat_impersonateAccount', [address]) // get some eth from a miner
  const account = await ethers.getSigner(address)
  await networkAdmin.sendTransaction({
    to: address,
    value: ethers.utils.parseEther('1.0'),
  })
  return account
}

export const getCorrectIndexValue = async (epoch: number) => {
  const r = epoch - 1

  const step1 = 1e6 + 7100
  const step2 = step1 / 1e6
  const step3 = step2 ** r
  const index = step3 * 1e9
  return ~~index
}

describe('TEST NEW STAKING CONTRACT', () => {
  let currentStaking: REDACTEDStaking
  let newStaking: REDACTEDStaking
  let newWarmup: StakingWarmup
  let newXBtrfly: XBTRFLY
  let distributor: Distributor
  let admin: SignerWithAddress
  let localAdmin: SignerWithAddress
  let staker: SignerWithAddress
  let startingBlock: number

  const deployAndSetEnvironment = async () => {
    ;[localAdmin, staker] = await ethers.getSigners()
    admin = await impersonateAddressAndReturnSigner(
      staker,
      '0x20b92862dcb9976e0aa11fae766343b7317ab349',
    )
    currentStaking = await ethers.getContractAt('REDACTEDStaking', STAKING_ADDRESS)
    newXBtrfly = await deployXbtrfly()
    const currentEpoch = await currentStaking.epoch()
    const nextEpoch = currentEpoch[1].toNumber() + 1
    const currentBlock = await ethers.provider.blockNumber
    startingBlock = currentBlock + 100
    newStaking = await deployStaking(
      BTRFLY_ADDRESS,
      NEW_XBTRFLY_ADDRESS,
      2200,
      nextEpoch,
      startingBlock,
    )
    newWarmup = await deployWarmup(newStaking.address, BTRFLY_ADDRESS)
    distributor = await ethers.getContractAt('Distributor', DISTRIBUTOR_ADDRESS)

    await mineBlocks(10)
  }

  beforeEach(async () => {
    // ;[localAdmin, staker] = await ethers.getSigners()
    // admin = await impersonateAddressAndReturnSigner(
    //   staker,
    //   '0x20b92862dcb9976e0aa11fae766343b7317ab349',
    // )
    // currentStaking = await ethers.getContractAt('REDACTEDStaking', STAKING_ADDRESS)
    // newXBtrfly = await deployXbtrfly()
    // const currentEpoch = await currentStaking.epoch()
    // const nextEpoch = currentEpoch[1].toNumber() + 1
    // const currentBlock = await ethers.provider.blockNumber
    // startingBlock = currentBlock + 100
    // newStaking = await deployStaking(
    //   BTRFLY_ADDRESS,
    //   NEW_XBTRFLY_ADDRESS,
    //   2200,
    //   nextEpoch,
    //   startingBlock,
    // )
    // newWarmup = await deployWarmup(newStaking.address, BTRFLY_ADDRESS)
    // distributor = await ethers.getContractAt('Distributor', DISTRIBUTOR_ADDRESS)
    // await mineBlocks(10)
    await deployAndSetEnvironment()
  })

  it('loads current staking contract', async () => {
    const index = await currentStaking.index()
    console.log(index)
  })

  it('set new staking contract', async () => {
    // @ts-ignore
    const currentEpoch = await currentStaking.epoch()
    const nextEpoch = currentEpoch[1].toNumber() + 1
    const newIndex = await getCorrectIndexValue(nextEpoch)
    await newXBtrfly.connect(localAdmin).initialize(newStaking.address)
    console.log('new btrfly init')
    await newXBtrfly.connect(localAdmin).setIndex(newIndex.toString())
    console.log('new btrfly set index')
    await newStaking.connect(localAdmin).setContract('0', distributor.address)
    console.log('new staking set distributor')
    await newStaking.setContract('1', newWarmup.address)
    console.log('new staking set warmup')
    await distributor.connect(admin).removeRecipient('0', currentStaking.address)
    console.log('distro remove recipient')
    await distributor.connect(admin).addRecipient(newStaking.address, 7100)
    console.log('distro add recipient')
    await mineBlocks(2205)
    const currentBlock = await ethers.provider.getBlockNumber()
    console.log('current block: ', currentBlock, ' end epoch block', currentEpoch[2].toNumber())
    const newEpoch = await newStaking.epoch()
    console.log('new epoch', newEpoch)
    await newStaking.rebase()
  })
})
