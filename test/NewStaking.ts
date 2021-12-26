import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BTRFLY, Distributor, REDACTEDStaking, StakingWarmup, XBTRFLY } from '../typechain'
import { ethers } from 'hardhat'
import {
  BTRFLY_ADDRESS,
  DISTRIBUTOR_ADDRESS,
  STAKING_ADDRESS,
  TREASURY_MANAGER,
  XBTRFLY_ADDRESS,
} from './constants'
import { expect } from 'chai'
import { deployStaking, deployWarmup, deployXbtrfly } from './ProtocolDeployment'
import { mineBlocks } from './utils'

/**
 * @dev util functions
 */

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

/**
 * @dev Tests
 */

describe('Test Replacing the Staking Contract', () => {
  let localAdmin: SignerWithAddress
  let manager: SignerWithAddress
  let staker: SignerWithAddress
  let deprecatedStakingContract: REDACTEDStaking
  let deprecatedXbtrfly: XBTRFLY
  let distributor: Distributor
  let btrfly: BTRFLY

  let fixedStakingContract: REDACTEDStaking
  let fixedXBtrfly: XBTRFLY
  let fixedWarmup: StakingWarmup
  let fixedStakingStartingEpoch: number
  let startingEpoch: number
  let startingBlock: number

  beforeEach(async () => {
    /**
     * @dev Setup Signers
     */
    ;[localAdmin] = await ethers.getSigners()
    manager = await impersonateAddressAndReturnSigner(localAdmin, TREASURY_MANAGER)
    staker = await impersonateAddressAndReturnSigner(
      localAdmin,
      '0x91b0263b945d9f17207ba168921a25ec7c0d361a',
    )
    /**
     * @dev Setup Contracts From Mainnet
     */
    deprecatedStakingContract = await ethers.getContractAt('REDACTEDStaking', STAKING_ADDRESS)
    deprecatedXbtrfly = await ethers.getContractAt('XBTRFLY', XBTRFLY_ADDRESS)
    btrfly = await ethers.getContractAt('BTRFLY', BTRFLY_ADDRESS)
    distributor = await ethers.getContractAt('Distributor', DISTRIBUTOR_ADDRESS)

    /**
     * @dev Fixed New Contracts
     */
    fixedXBtrfly = await deployXbtrfly()
    startingEpoch = (await deprecatedStakingContract.epoch())[1].toNumber() + 1
    startingBlock = (await deprecatedStakingContract.epoch())[2].toNumber()
    fixedStakingContract = await deployStaking(
      btrfly.address,
      fixedXBtrfly.address,
      2200,
      startingEpoch,
      startingBlock,
    )
    fixedStakingStartingEpoch = startingEpoch
    fixedWarmup = await deployWarmup(fixedStakingContract.address, btrfly.address)
  })

  it('mainnet contracts are loaded', async () => {
    const xbtrflyTotalSupply = await deprecatedXbtrfly.totalSupply()
    expect(Number(xbtrflyTotalSupply)).to.be.greaterThan(1)
  })

  it('test new staking contract', async () => {
    /**
     * @dev set up the new staking contract
     */
    // init fixed xbtrfly
    const startingIndex = await getCorrectIndexValue(startingEpoch)
    console.log('starting index', startingIndex)
    await fixedXBtrfly.setIndex(startingIndex)
    await fixedXBtrfly.initialize(fixedStakingContract.address)
    // set fixed staking with distributor
    await fixedStakingContract.setContract('0', distributor.address)
    await fixedStakingContract.setContract('1', fixedWarmup.address)
    //  remove deprecated staking from distributor and replace with new
    await distributor.connect(manager).removeRecipient('0', deprecatedStakingContract.address)
    await distributor.connect(manager).addRecipient(fixedStakingContract.address, 7100)

    /**
     * @dev skip till starting block of new staking
     */
    await mineBlocks(2200)
    const currentBlock = ethers.provider.blockNumber
    expect(currentBlock).to.be.greaterThanOrEqual(startingBlock)

    /**
     * @dev rebase the staking contract and check the new index
     */
    await fixedStakingContract.rebase()
    const newEpoch = await fixedStakingContract.epoch()
    expect(newEpoch[1].toNumber()).to.greaterThan(startingEpoch)
    const newIndex = getCorrectIndexValue(11)
    console.log('new index ', newIndex)
    console.log('index on deprecated Xbtrfly', await deprecatedXbtrfly.INDEX())
  })

  it('checks current staking and balance go up', async () => {
    const epoch = await deprecatedStakingContract.epoch()
    const indexShouldBeNow = getCorrectIndexValue(epoch[1].toNumber())
    console.log('index should be', indexShouldBeNow)
    const balanceOfStakerNow = await deprecatedXbtrfly.balanceOf(staker.address)
    console.log('balance before: ', balanceOfStakerNow)
    await mineBlocks(2300)
    await deprecatedStakingContract.rebase()
    const balanceOfStakerAfter = await deprecatedXbtrfly.balanceOf(staker.address)
    console.log('balance after: ', balanceOfStakerAfter)
    console.log(await deprecatedXbtrfly.balanceForGons(ethers.utils.parseUnits('1', 'gwei')))
  })

  it('doesnt change increase amount when changed to billion', async () => {
    // init fixed xbtrfly
    // init fixed xbtrfly
    const startingIndex = await getCorrectIndexValue(startingEpoch)
    console.log('starting index', startingIndex)
    await fixedXBtrfly.setIndex(startingIndex)
    await fixedXBtrfly.initialize(fixedStakingContract.address)
    // set fixed staking with distributor
    await fixedStakingContract.setContract('0', distributor.address)
    await fixedStakingContract.setContract('1', fixedWarmup.address)
    //  remove deprecated staking from distributor and replace with new
    await distributor.connect(manager).removeRecipient('0', deprecatedStakingContract.address)
    await distributor.connect(manager).addRecipient(fixedStakingContract.address, 7100)
    const balanceOfStakerNow = await fixedXBtrfly.balanceOf(staker.address)
    console.log('balance before: ', balanceOfStakerNow)

    await mineBlocks(2300)
    await fixedStakingContract.rebase()
    const balanceOfStakerAfter = await fixedXBtrfly.balanceOf(staker.address)
    console.log('balance after: ', balanceOfStakerAfter)
  })
})
