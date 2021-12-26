/* eslint-disable camelcase */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import {
  CRV,
  CRV__factory,
  REDACTEDBondDepository,
  REDACTEDBondingCalculator,
  REDACTEDTreasury,
  XBTRFLY,
} from '../typechain'
import {
  BONDING_CALCULATOR,
  BTRFLY_ADDRESS,
  GNOSIS_SAFE_ADDRESS,
  STAKING_ADDRESS,
  TREASURY_ADDRESS,
  TREASURY_MANAGER,
  ZERO_ADDRESS,
} from './constants'
import { deployBond, queueAndToggleReserveDepositor } from './ProtocolDeployment'
import { getBondingCalculator, getTREASURY } from './utils'

const impersonateAddressAndReturnSigner = async (
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

describe('Live Bonding', () => {
  let treasury: REDACTEDTreasury
  let bondingCalculator: REDACTEDBondingCalculator
  let crvBonds: REDACTEDBondDepository
  let treasuryManager: SignerWithAddress
  let crv: CRV
  let bonder: SignerWithAddress
  let ohmDao: SignerWithAddress
  let gnosis: SignerWithAddress
  let realCRV: CRV

  beforeEach(async () => {
    ;[bonder, ohmDao] = await ethers.getSigners()
    treasuryManager = await impersonateAddressAndReturnSigner(bonder, TREASURY_MANAGER)
    gnosis = await impersonateAddressAndReturnSigner(bonder, GNOSIS_SAFE_ADDRESS)
    treasury = await getTREASURY(TREASURY_ADDRESS)
    bondingCalculator = await getBondingCalculator(BONDING_CALCULATOR)
    const CrvFactory = (await ethers.getContractFactory('CRV')) as CRV__factory
    crv = await CrvFactory.deploy()
    await crv.connect(bonder).mint(bonder.address)
    await crv.connect(bonder).mint(treasuryManager.address)
    crvBonds = await deployBond(
      BTRFLY_ADDRESS,
      crv.address,
      treasury.address,
      GNOSIS_SAFE_ADDRESS,
      bondingCalculator.address,
      ohmDao.address,
      ohmDao.address,
      '100',
      33110,
      '8500',
      '100',
      9500,
      ethers.utils.parseEther('100000000000').toString(),
      '500',
      '0',
      STAKING_ADDRESS,
      false,
    )

    realCRV = await ethers.getContractAt('CRV', '0xd533a949740bb3306d119cc777fa900ba034cd52')
  })

  it('deploys crv bonds', async () => {
    const a = await crvBonds.totalDebt()
    console.log(a)
  })

  it('loads gnosis', async () => {
    const b = await gnosis.address
    console.log(b)
  })

  it('loads real curve', async () => {
    const balance = await realCRV.balanceOf(gnosis.address)
    expect(Number(await ethers.utils.formatEther(balance))).to.be.greaterThan(0)
    console.log('balance is ', ethers.utils.formatEther(balance))
  })

  //   await treasury.queue('0', daiBond.address);
  //   await treasury.queue('0', fraxBond.address);
  //   await treasury.toggle('0', daiBond.address, zeroAddress);
  //   await treasury.toggle('0', fraxBond.address, zeroAddress);
})
